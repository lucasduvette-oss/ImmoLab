import "server-only";

import { distanceMeters, type Comparable, type EstimationPropertyType } from "@/lib/estimation";
import type { SearchInput } from "@/lib/estimation-schema";
import { reverseCitycode } from "@/lib/geocoding";
import { parseCsv } from "./csv";
import { fetchWithRetry, MIN_SALE_PRICE, readText, toNumber } from "./common";
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
  // Surfaces de terrain par vente : une parcelle peut avoir plusieurs natures de culture (sol, jardin…),
  // chacune sur sa propre ligne. On les collecte avant la suppression des doublons, qui ne garde qu'une ligne.
  const landByMutation = new Map<string, Map<string, number>>();
  for (const r of rows) {
    if (r.nature_mutation !== "Vente") continue;
    // L'identifiant est construit par Etalab : on y ajoute date et prix pour éviter toute collision.
    const key = `${r.id_mutation}|${r.date_mutation}|${r.valeur_fonciere}`;
    const land = toNumber(r.surface_terrain);
    if (land) {
      const subdivisions = landByMutation.get(key) ?? new Map<string, number>();
      subdivisions.set(`${r.id_parcelle}|${r.code_nature_culture}|${r.surface_terrain}`, land);
      landByMutation.set(key, subdivisions);
    }
    const dedupKey = [r.id_mutation, r.id_parcelle, r.code_type_local, r.surface_reelle_bati, r.nombre_pieces_principales, r.valeur_fonciere, r.date_mutation].join("|");
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);
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

    const land = [...(landByMutation.get(key)?.values() ?? [])];
    const street = [local.adresse_numero, local.adresse_suffixe, local.adresse_nom_voie].filter(Boolean).join(" ");
    sales.push({
      id: `geodvf-${key}`,
      date: local.date_mutation,
      type,
      price,
      surface,
      rooms: toNumber(local.nombre_pieces_principales),
      landSurface: land.length ? land.reduce((a, b) => a + b, 0) : null,
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

/** Taille maximale d'un fichier communal (les plus grandes villes dépassent rarement 20 Mo par an). */
const MAX_FILE_BYTES = 80 * 1024 * 1024;

async function loadCommuneYear(citycode: string, year: number, deadline?: AbortSignal): Promise<GeoSale[]> {
  const key = `${citycode}-${year}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.sales;

  const url = `${baseUrl()}/${year}/communes/${departmentOf(citycode)}/${citycode}.csv`;
  const res = await fetchWithRetry(url, { timeoutMs: 25_000, retries: 1, retryNetworkErrors: true, cache: "no-store", deadline });
  // 404 : aucune vente cette année-là dans la commune (ou année pas encore publiée).
  const sales = res.status === 404 ? [] : res.ok ? reduceGeoDvfRows(parseCsv(await readText(res, MAX_FILE_BYTES))) : [];
  if (cache.size > 40) cache.delete(cache.keys().next().value as string);
  cache.set(key, { at: Date.now(), sales });
  return sales;
}

/** Code INSEE valide (5 caractères, 2A / 2B pour la Corse) : il sert à construire l'adresse du fichier. */
const CITYCODE = /^(\d{5}|2[AB]\d{3})$/;

/**
 * Points où l'on cherche la commune : le centre, une grille couvrant le cercle et 16 points sur le cercle.
 * L'écart de la grille dépend du rayon (200 à 600 m), pour ne pas oublier une petite commune ou un arrondissement.
 */
export function samplePoints(latitude: number, longitude: number, radiusM: number): [number, number][] {
  const mPerDegLat = 111_320;
  const mPerDegLon = mPerDegLat * Math.cos((latitude * Math.PI) / 180);
  const step = Math.min(600, Math.max(200, radiusM / 3));
  const points: [number, number][] = [[latitude, longitude]];
  const n = Math.floor(radiusM / step);
  for (let i = -n; i <= n; i++) {
    for (let j = -n; j <= n; j++) {
      if ((i === 0 && j === 0) || Math.hypot(i * step, j * step) > radiusM) continue;
      points.push([latitude + (i * step) / mPerDegLat, longitude + (j * step) / mPerDegLon]);
    }
  }
  for (let k = 0; k < 16; k++) {
    const angle = (k * Math.PI) / 8;
    points.push([latitude + (radiusM * Math.cos(angle)) / mPerDegLat, longitude + (radiusM * Math.sin(angle)) / mPerDegLon]);
  }
  return points;
}

/** Communes touchées par le cercle de recherche (géocodage inverse de points répartis dans le cercle). */
async function communesAround(input: SearchInput): Promise<{ codes: string[]; geocodingDown: boolean }> {
  const codes = new Set<string>();
  if (input.citycode) codes.add(input.citycode);
  const points = samplePoints(input.latitude, input.longitude, input.radiusM);
  let missed = 0;
  // Par petits groupes, pour rester sous la limite du service de géocodage (50 requêtes par seconde).
  for (let i = 0; i < points.length; i += 5) {
    const found = await Promise.all(points.slice(i, i + 5).map(([lat, lon]) => reverseCitycode(lat, lon)));
    for (const code of found) {
      if (code && CITYCODE.test(code)) codes.add(code);
      else missed++;
    }
  }
  // Aucune réponse du tout : le service de géocodage est probablement indisponible.
  return { codes: [...codes], geocodingDown: missed === points.length };
}

/** Ventes comparables d'après les fichiers geo-dvf (source de repli). */
export async function findComparablesGeoDvf(
  input: SearchInput & { minDate: string },
  deadline?: AbortSignal,
): Promise<{ comparables: Comparable[]; notes: string[] }> {
  const { codes: communes, geocodingDown } = await communesAround(input);
  if (!communes.length) throw new DvfUnavailableError("Impossible de déterminer la commune du bien pour lire les données DVF.");

  const firstYear = Number(input.minDate.slice(0, 4));
  const lastYear = new Date().getFullYear();
  const jobs: [string, number][] = [];
  for (const c of communes) for (let y = firstYear; y <= lastYear; y++) jobs.push([c, y]);

  const sales: GeoSale[] = [];
  const failed = new Set<string>();
  for (let i = 0; i < jobs.length; i += 4) {
    const batch = await Promise.allSettled(jobs.slice(i, i + 4).map(([c, y]) => loadCommuneYear(c, y, deadline)));
    batch.forEach((b, k) => {
      if (b.status === "fulfilled") sales.push(...b.value);
      else failed.add(jobs[i + k][0]);
    });
  }
  // Sans les ventes de la commune du bien, le résultat n'aurait pas de sens : on s'arrête.
  const subjectCommune = input.citycode ?? communes[0];
  if (failed.has(subjectCommune) || failed.size === communes.length) {
    throw new DvfUnavailableError("Les fichiers DVF de data.gouv.fr sont momentanément indisponibles.");
  }

  const notes: string[] = [];
  if (failed.size) notes.push(`Ventes non chargées pour ${failed.size > 1 ? "les communes" : "la commune"} ${[...failed].join(", ")} (réessayez plus tard).`);
  if (geocodingDown) notes.push("Communes voisines non identifiées (service de géocodage indisponible) : seules les ventes de la commune du bien sont prises en compte.");

  const tolerance = input.surfaceTolerancePct / 100;
  const comparables = sales.flatMap((s) => {
    if (s.type !== input.type || s.date < input.minDate || s.price < MIN_SALE_PRICE) return [];
    if (s.surface < input.surface * (1 - tolerance) || s.surface > input.surface * (1 + tolerance)) return [];
    const distance = distanceMeters(input.latitude, input.longitude, s.latitude, s.longitude);
    if (distance > input.radiusM) return [];
    return [{ ...s, distance, pricePerSqm: s.price / s.surface, excluded: false, outlier: false }];
  });
  return { comparables, notes };
}
