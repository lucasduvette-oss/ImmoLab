import "server-only";

import { boundingBox, distanceMeters, splitBoundingBox, type Comparable, type EstimationPropertyType } from "@/lib/estimation";
import type { SearchInput } from "@/lib/estimation-schema";
import { fetchWithRetry, MIN_SALE_PRICE, normalizeLabel, readJson, toNumber } from "./common";
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

type Position = [number, number];
const isPosition = (c: unknown): c is Position => Array.isArray(c) && typeof c[0] === "number" && typeof c[1] === "number";

/** Centre d'un contour (moyenne des sommets ; le dernier sommet répète le premier, on ne le compte qu'une fois). */
function ringCenter(ring: Position[]): { latitude: number; longitude: number } | null {
  const last = ring[ring.length - 1];
  const closed = ring.length > 1 && last[0] === ring[0][0] && last[1] === ring[0][1];
  const points = closed ? ring.slice(0, -1) : ring;
  if (!points.length) return null;
  return {
    longitude: points.reduce((s, p) => s + p[0], 0) / points.length,
    latitude: points.reduce((s, p) => s + p[1], 0) / points.length,
  };
}

/**
 * Centre de chaque parcelle d'une vente (contour extérieur de chaque polygone ; suffisant à l'échelle d'une parcelle).
 * Accepte Polygon et MultiPolygon.
 */
export function parcelCenters(geometry: Geometry): { latitude: number; longitude: number }[] {
  const coordinates = geometry?.coordinates;
  if (!Array.isArray(coordinates) || !coordinates.length) return [];
  // Polygon : [contour][sommet] ; MultiPolygon : [polygone][contour][sommet].
  const polygons = (isPosition((coordinates as unknown[][])[0]?.[0]) ? [coordinates] : coordinates) as unknown[];
  const centers: { latitude: number; longitude: number }[] = [];
  for (const polygon of polygons) {
    const outer = Array.isArray(polygon) ? polygon[0] : null;
    if (!Array.isArray(outer) || !outer.every(isPosition)) continue;
    const center = ringCenter(outer as Position[]);
    if (center) centers.push(center);
  }
  return centers;
}

/**
 * Position retenue pour une vente : la parcelle la plus proche du bien estimé
 * (une vente peut réunir une parcelle bâtie et un terrain éloigné).
 */
export function geometryCenter(geometry: Geometry, near?: { latitude: number; longitude: number }) {
  const centers = parcelCenters(geometry);
  if (!centers.length) return null;
  if (!near) return centers[0];
  let best = centers[0];
  let bestDistance = Infinity;
  for (const c of centers) {
    const d = distanceMeters(near.latitude, near.longitude, c.latitude, c.longitude);
    if (d < bestDistance) {
      best = c;
      bestDistance = d;
    }
  }
  return best;
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

  const center = geometryCenter(feature.geometry, input);
  if (!center) return null;
  const distance = distanceMeters(input.latitude, input.longitude, center.latitude, center.longitude);
  if (distance > input.radiusM) return null;

  // L'API ne donne que le code INSEE de la commune : on n'affiche le nom que s'il s'agit de celle du bien.
  const communes = Array.isArray(p.l_codinsee) ? (p.l_codinsee as unknown[]).map(String) : [];
  const label = input.citycode && communes.includes(input.citycode) && input.city ? input.city : null;

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

/** Taille maximale d'une page de l'API (500 ventes avec leurs parcelles). */
const MAX_PAGE_BYTES = 40 * 1024 * 1024;
/** Nombre maximal de pages lues pour une recherche, tous carreaux confondus. */
const MAX_PAGES_PER_SEARCH = 40;

async function fetchPage(url: string, deadline?: AbortSignal): Promise<{ features: CeremaFeature[]; hasNext: boolean }> {
  const res = await fetchWithRetry(url, {
    headers: { accept: "application/json", "user-agent": "ImmoLab/1.0 (estimation immobiliere)" },
    timeoutMs: 15_000,
    cache: "no-store",
    deadline,
  });
  if (!res.ok) throw new DvfUnavailableError(`Le service DVF du Cerema a refusé la requête (${res.status}).`);
  if (!(res.headers.get("content-type") ?? "").includes("json")) {
    throw new DvfUnavailableError("Le service DVF du Cerema a renvoyé une réponse inattendue.");
  }
  const json = await readJson<{ features?: unknown; next?: string | null }>(res, MAX_PAGE_BYTES);
  // Sans liste de ventes, la réponse n'est pas celle attendue (message d'erreur, format modifié…).
  if (!Array.isArray(json.features)) throw new DvfUnavailableError("Le service DVF du Cerema a renvoyé une réponse inattendue.");
  return { features: json.features as CeremaFeature[], hasNext: Boolean(json.next) };
}

/** Ventes comparables autour du bien d'après l'API du Cerema. */
export async function findComparablesCerema(
  input: SearchInput & { minDate: string },
  deadline?: AbortSignal,
): Promise<{ comparables: Comparable[]; truncated: boolean }> {
  const tiles = splitBoundingBox(boundingBox(input.latitude, input.longitude, input.radiusM), MAX_TILE_DEGREES);
  const tolerance = input.surfaceTolerancePct / 100;
  const comparables: Comparable[] = [];
  let truncated = false;
  let pagesRead = 0;

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
      if (pagesRead >= MAX_PAGES_PER_SEARCH) {
        truncated = true;
        break;
      }
      params.set("page", String(page));
      const { features, hasNext } = await fetchPage(`${baseUrl()}/dvf_opendata/geomutations/?${params.toString()}`, deadline);
      pagesRead++;
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
