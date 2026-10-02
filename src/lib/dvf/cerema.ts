import "server-only";

import { boundingBox, distanceMeters, splitBoundingBox, type Comparable, type EstimationPropertyType } from "@/lib/estimation";
import type { SearchInput } from "@/lib/estimation-schema";
import { fetchWithRetry, MIN_SALE_PRICE, normalizeLabel, toNumber } from "./common";
import { DvfUnavailableError } from "./types";

/**
 * Source principale : API « Données foncières » du Cerema, jeu DVF+ open data
 * (https://apidf-preprod.cerema.fr, gratuit, sans clé). Sources consultées pour ce module :
 * client officiel github.com/CEREMA/apifoncier et clients github.com/rcadot/py.apifoncier, r.apifoncier.
 *
 * Points clés :
 *  - seul /dvf_opendata/geomutations/ fournit une géométrie (parcelles en MultiPolygon) ;
 *  - la zone in_bbox (lon_min,lat_min,lon_max,lat_max) est limitée à 0,02° × 0,02° : on découpe en carreaux ;
 *  - in_bbox sélectionne les ventes dont les parcelles TOUCHENT la zone : on recalcule la distance ;
 *  - les décimaux (valeurfonc, sbati…) arrivent sous forme de texte (« 250000.00 ») ;
 *  - pagination « page / page_size » (500 au plus), champ « next » vide sur la dernière page ;
 *  - service hébergé en « préproduction » : lent ou indisponible par moments (d'où la source de repli).
 */

export const CEREMA_SOURCE = "DVF+ open data (Cerema, API Données foncières)";
const MAX_TILE_DEGREES = 0.0199;
const PAGE_SIZE = 500;
const MAX_PAGES_PER_TILE = 10;

/** Codes de la typologie DVF+ : « UNE MAISON » = 111, « UN APPARTEMENT » = 121. */
const TYPE_CODES: Record<EstimationPropertyType, string> = { maison: "111", appartement: "121" };

function baseUrl() {
  return (process.env.DVF_API_URL ?? "https://apidf-preprod.cerema.fr").replace(/\/$/, "");
}

type Geometry = { type?: string; coordinates?: unknown } | null | undefined;
export type CeremaFeature = { id?: unknown; geometry?: Geometry; properties?: Record<string, unknown> };

/** Centre des parcelles d'une vente (moyenne des sommets, suffisant à l'échelle d'une parcelle). */
export function geometryCenter(geometry: Geometry): { latitude: number; longitude: number } | null {
  if (!geometry?.coordinates) return null;
  let sumLon = 0;
  let sumLat = 0;
  let n = 0;
  const isPosition = (c: unknown): c is [number, number] => Array.isArray(c) && typeof c[0] === "number" && typeof c[1] === "number";
  const visit = (c: unknown) => {
    if (isPosition(c)) {
      sumLon += c[0];
      sumLat += c[1];
      n++;
    } else if (Array.isArray(c) && c.length && isPosition(c[0])) {
      // Contour de polygone : le dernier sommet répète le premier, on ne le compte qu'une fois.
      const ring = c as [number, number][];
      const last = ring[ring.length - 1];
      const closed = ring.length > 1 && last[0] === ring[0][0] && last[1] === ring[0][1];
      (closed ? ring.slice(0, -1) : ring).forEach(visit);
    } else if (Array.isArray(c)) c.forEach(visit);
  };
  visit(geometry.coordinates);
  return n ? { latitude: sumLat / n, longitude: sumLon / n } : null;
}

/** Nombre de pièces principales d'après les compteurs nbapt1pp…nbapt5pp / nbmai1pp…nbmai5pp (5 = « 5 ou plus »). */
function roomsFrom(props: Record<string, unknown>, type: EstimationPropertyType): number | null {
  const prefix = type === "maison" ? "nbmai" : "nbapt";
  for (let n = 1; n <= 5; n++) if ((toNumber(props[`${prefix}${n}pp`]) ?? 0) >= 1) return n;
  return null;
}

/**
 * Convertit une vente de l'API en comparable, ou null si elle ne convient pas :
 * vente « classique » (ni VEFA, ni échange, adjudication, terrain à bâtir…), UN seul logement
 * du type recherché (dépendances acceptées), dans la période, la surface et le rayon demandés.
 */
export function ceremaToComparable(
  feature: CeremaFeature,
  input: SearchInput & { minDate: string },
): Comparable | null {
  const p = feature.properties ?? {};
  if (normalizeLabel(p.libnatmut) !== "VENTE") return null;
  if (p.vefa === true || p.vefa === "true") return null;
  if (String(p.codtypbien ?? "") !== TYPE_CODES[input.type]) return null;

  // Un seul logement du type recherché, sans local d'activité (compteurs présents avec fields=all).
  const nbMai = toNumber(p.nblocmai);
  const nbApt = toNumber(p.nblocapt);
  const nbAct = toNumber(p.nblocact) ?? 0;
  if (nbMai !== null && nbApt !== null) {
    const ok = input.type === "maison" ? nbMai === 1 && nbApt === 0 : nbApt === 1 && nbMai === 0;
    if (!ok || nbAct > 0) return null;
  }

  const date = typeof p.datemut === "string" ? p.datemut.slice(0, 10) : null;
  if (!date || date < input.minDate) return null;

  const price = toNumber(p.valeurfonc);
  const surface = toNumber(input.type === "maison" ? p.sbatmai : p.sbatapt) || toNumber(p.sbati);
  if (!price || price < MIN_SALE_PRICE || !surface || surface <= 0) return null;
  const tolerance = input.surfaceTolerancePct / 100;
  if (surface < input.surface * (1 - tolerance) || surface > input.surface * (1 + tolerance)) return null;

  const center = geometryCenter(feature.geometry);
  if (!center) return null;
  const distance = distanceMeters(input.latitude, input.longitude, center.latitude, center.longitude);
  if (distance > input.radiusM) return null;

  const communes = Array.isArray(p.l_codinsee) ? (p.l_codinsee as unknown[]).map(String) : [];
  const label =
    input.citycode && communes.includes(input.citycode) && input.city ? input.city : communes.length ? `Commune ${communes.join(", ")}` : null;

  return {
    id: `cerema-${String(p.idmutinvar ?? p.idopendata ?? feature.id ?? `${date}-${price}-${surface}`)}`,
    date,
    type: input.type,
    price,
    surface,
    rooms: roomsFrom(p, input.type),
    landSurface: toNumber(p.sterr) || null,
    label,
    latitude: center.latitude,
    longitude: center.longitude,
    distance,
    pricePerSqm: price / surface,
    excluded: false,
    outlier: false,
  };
}

async function fetchPage(url: string): Promise<{ features: CeremaFeature[]; hasNext: boolean }> {
  const res = await fetchWithRetry(url, {
    headers: { accept: "application/json", "user-agent": "ImmoLab/1.0 (estimation immobiliere)" },
    timeoutMs: 15_000,
    cache: "no-store",
  });
  if (!res.ok) throw new DvfUnavailableError(`Le service DVF du Cerema a refusé la requête (${res.status}).`);
  if (!(res.headers.get("content-type") ?? "").includes("json")) {
    throw new DvfUnavailableError("Le service DVF du Cerema a renvoyé une réponse inattendue.");
  }
  const json = (await res.json()) as { features?: CeremaFeature[]; next?: string | null };
  return { features: Array.isArray(json.features) ? json.features : [], hasNext: Boolean(json.next) };
}

/** Ventes comparables autour du bien d'après l'API du Cerema. */
export async function findComparablesCerema(input: SearchInput & { minDate: string }): Promise<{ comparables: Comparable[]; truncated: boolean }> {
  const tiles = splitBoundingBox(boundingBox(input.latitude, input.longitude, input.radiusM), MAX_TILE_DEGREES);
  const tolerance = input.surfaceTolerancePct / 100;
  const comparables: Comparable[] = [];
  let truncated = false;

  for (const tile of tiles) {
    const params = new URLSearchParams({
      in_bbox: [tile.minLon, tile.minLat, tile.maxLon, tile.maxLat].map((v) => v.toFixed(6)).join(","),
      codtypbien: TYPE_CODES[input.type],
      idnatmut: "1", // 1 = Vente
      anneemut_min: input.minDate.slice(0, 4),
      sbati_min: String(Math.floor(input.surface * (1 - tolerance))),
      sbati_max: String(Math.ceil(input.surface * (1 + tolerance))),
      fields: "all",
      page_size: String(PAGE_SIZE),
    });
    for (let page = 1; page <= MAX_PAGES_PER_TILE; page++) {
      params.set("page", String(page));
      const { features, hasNext } = await fetchPage(`${baseUrl()}/dvf_opendata/geomutations/?${params.toString()}`);
      for (const f of features) {
        const c = ceremaToComparable(f, input);
        if (c) comparables.push(c);
      }
      if (!hasNext) break;
      if (page === MAX_PAGES_PER_TILE) truncated = true;
    }
  }
  return { comparables, truncated };
}
