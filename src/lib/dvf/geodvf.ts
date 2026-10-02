import "server-only";

import { distanceMeters, type Comparable, type EstimationPropertyType } from "@/lib/estimation";
import type { SearchInput } from "@/lib/estimation-schema";
import { reverseCitycode } from "@/lib/geocoding";
import { parseCsv } from "./csv";
import { fetchWithRetry, MIN_SALE_PRICE, toNumber } from "./common";
import { DvfUnavailableError } from "./types";

/**
 * Source de repli : fichiers « DVF géolocalisées » d'Etalab (data.gouv.fr), un fichier CSV
 * par commune et par année : files.data.gouv.fr/geo-dvf/latest/csv/{année}/communes/{dép}/{commune}.csv
 * Méthode de reconstitution d'une vente par mutation reprise du traitement statistique officiel
 * de data.gouv.fr (github.com/datagouv/datagouvfr_data_pipelines, dossier data_processing/dvf).
 */

export const GEODVF_SOURCE = "DVF géolocalisées (Etalab / DGFiP, Licence Ouverte 2.0)";

function baseUrl() {
  return (process.env.GEODVF_URL ?? "https://files.data.gouv.fr/geo-dvf/latest/csv").replace(/\/$/, "");
}

/** Dossier du département : 3 caractères outre-mer (971…), sinon 2 (dont 2A / 2B). */
export function departmentOf(citycode: string): string {
  return citycode.startsWith("97") ? citycode.slice(0, 3) : citycode.slice(0, 2);
}

/** Vente reconstituée (une par mutation), indépendante du bien estimé. */
export type GeoSale = {
  id: string;
  date: string;
  type: EstimationPropertyType;
  price: number;
  surface: number;
  rooms: number | null;
  landSurface: number | null;
  label: string | null;
  latitude: number;
  longitude: number;
};

const TYPE_BY_CODE: Record<string, EstimationPropertyType> = { "1": "maison", "2": "appartement" };

/**
 * Lignes CSV → ventes d'UN seul logement (maison ou appartement), dépendances et terrain acceptés.
 * Étapes : doublons supprimés ; ventes « classiques » uniquement ; regroupement par mutation ;
 * exactement un local principal (maison, appartement ou local d'activité) et il doit être un logement.
 */
export function reduceGeoDvfRows(rows: Record<string, string>[]): GeoSale[] {
  const seen = new Set<string>();
  const groups = new Map<string, Record<string, string>[]>();
  for (const r of rows) {
    const dedupKey = [r.id_mutation, r.id_parcelle, r.code_type_local, r.surface_reelle_bati, r.nombre_pieces_principales, r.valeur_fonciere, r.date_mutation].join("|");
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);
    if (r.nature_mutation !== "Vente") continue;
    // L'identifiant est construit par Etalab : on y ajoute date et prix pour éviter toute collision.
    const key = `${r.id_mutation}|${r.date_mutation}|${r.valeur_fonciere}`;
    const group = groups.get(key);
    if (group) group.push(r);
    else groups.set(key, [r]);
  }

  const sales: GeoSale[] = [];
  for (const [key, group] of groups) {
    const principal = group.filter((r) => ["1", "2", "4"].includes(r.code_type_local));
    if (principal.length !== 1) continue;
    const local = principal[0];
    const type = TYPE_BY_CODE[local.code_type_local];
    if (!type) continue;

    const price = toNumber(local.valeur_fonciere);
    const surface = toNumber(local.surface_reelle_bati);
    const withCoords = [local, ...group].find((r) => toNumber(r.latitude) !== null && toNumber(r.longitude) !== null);
    if (!price || !surface || !withCoords) continue;

    const parcels = new Map<string, number>();
    for (const r of group) {
      const land = toNumber(r.surface_terrain);
      if (land) parcels.set(r.id_parcelle, land);
    }
    const street = [local.adresse_numero, local.adresse_suffixe, local.adresse_nom_voie].filter(Boolean).join(" ");
    sales.push({
      id: `geodvf-${key}`,
      date: local.date_mutation,
      type,
      price,
      surface,
      rooms: toNumber(local.nombre_pieces_principales),
      landSurface: parcels.size ? [...parcels.values()].reduce((a, b) => a + b, 0) : null,
      label: [street, local.nom_commune].filter(Boolean).join(", ") || null,
      latitude: toNumber(withCoords.latitude)!,
      longitude: toNumber(withCoords.longitude)!,
    });
  }
  return sales;
}

// Cache en mémoire des ventes déjà lues (par commune et année) : les fichiers changent deux fois par an.
const cache = new Map<string, { at: number; sales: GeoSale[] }>();
const CACHE_MS = 12 * 60 * 60 * 1000;

async function loadCommuneYear(citycode: string, year: number): Promise<GeoSale[]> {
  const key = `${citycode}-${year}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.sales;

  const url = `${baseUrl()}/${year}/communes/${departmentOf(citycode)}/${citycode}.csv`;
  const res = await fetchWithRetry(url, { timeoutMs: 25_000, retries: 1, cache: "no-store" });
  // 404 : aucune vente cette année-là dans la commune (ou année pas encore publiée).
  const sales = res.status === 404 ? [] : res.ok ? reduceGeoDvfRows(parseCsv(await res.text())) : [];
  if (cache.size > 40) cache.delete(cache.keys().next().value as string);
  cache.set(key, { at: Date.now(), sales });
  return sales;
}

/** Communes touchées par le cercle de recherche : celle du bien + celles de 8 points sur le cercle. */
async function communesAround(input: SearchInput): Promise<string[]> {
  const codes = new Set<string>();
  if (input.citycode) codes.add(input.citycode);
  const dLat = (input.radiusM / 6_371_000) * (180 / Math.PI);
  const dLon = dLat / Math.cos((input.latitude * Math.PI) / 180);
  const points = [[input.latitude, input.longitude] as const];
  for (let k = 0; k < 8; k++) {
    const angle = (k * Math.PI) / 4;
    points.push([input.latitude + dLat * Math.cos(angle), input.longitude + dLon * Math.sin(angle)] as const);
  }
  const found = await Promise.all(points.map(([lat, lon]) => reverseCitycode(lat, lon)));
  found.forEach((c) => c && codes.add(c));
  return [...codes];
}

/** Ventes comparables d'après les fichiers geo-dvf (source de repli). */
export async function findComparablesGeoDvf(input: SearchInput & { minDate: string }): Promise<Comparable[]> {
  const communes = await communesAround(input);
  if (!communes.length) throw new DvfUnavailableError("Impossible de déterminer la commune du bien pour lire les données DVF.");

  const firstYear = Number(input.minDate.slice(0, 4));
  const lastYear = new Date().getFullYear();
  const jobs: [string, number][] = [];
  for (const c of communes) for (let y = firstYear; y <= lastYear; y++) jobs.push([c, y]);

  const sales: GeoSale[] = [];
  for (let i = 0; i < jobs.length; i += 4) {
    const batch = await Promise.all(jobs.slice(i, i + 4).map(([c, y]) => loadCommuneYear(c, y)));
    batch.forEach((b) => sales.push(...b));
  }

  const tolerance = input.surfaceTolerancePct / 100;
  return sales.flatMap((s) => {
    if (s.type !== input.type || s.date < input.minDate || s.price < MIN_SALE_PRICE) return [];
    if (s.surface < input.surface * (1 - tolerance) || s.surface > input.surface * (1 + tolerance)) return [];
    const distance = distanceMeters(input.latitude, input.longitude, s.latitude, s.longitude);
    if (distance > input.radiusM) return [];
    return [{ ...s, distance, pricePerSqm: s.price / s.surface, excluded: false, outlier: false }];
  });
}
