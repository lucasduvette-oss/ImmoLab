import "server-only";

import { distanceMeters, type Comparable, type EstimationPropertyType } from "@/lib/estimation";
import type { SearchInput } from "@/lib/estimation-schema";
import { reverseCommune } from "@/lib/geocoding";
import { parseCsv } from "./csv";
import { fetchWithRetry, MIN_SALE_PRICE, readText, SEARCH_DEADLINE_MS, toNumber } from "./common";
import { DvfTooLongError, DvfUnavailableError } from "./types";

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

async function loadCommuneYear(citycode: string, year: number, deadline: AbortSignal): Promise<GeoSale[]> {
  const key = `${citycode}-${year}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.sales;

  const url = `${baseUrl()}/${year}/communes/${departmentOf(citycode)}/${citycode}.csv`;
  let sales: GeoSale[] = [];
  // Deux essais : une coupure pendant le téléchargement d'un gros fichier est la panne la plus probable.
  for (let attempt = 0; ; attempt++) {
    const res = await fetchWithRetry(url, { timeoutMs: 25_000, retries: 1, retryNetworkErrors: true, cache: "no-store", deadline });
    // 404 : aucune vente cette année-là dans la commune (ou année pas encore publiée).
    if (!res.ok) break;
    try {
      sales = reduceGeoDvfRows(parseCsv(await readText(res, MAX_FILE_BYTES)));
      break;
    } catch (e) {
      if (deadline.aborted) throw new DvfTooLongError();
      if (attempt >= 1 || !(e instanceof DvfUnavailableError) || !e.retryable) throw e;
    }
  }
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

/** Temps accordé à la recherche des communes voisines (avant le téléchargement des fichiers). */
const GEOCODING_BUDGET_MS = 10_000;
/** Requêtes de géocodage par groupe, et durée minimale d'un groupe : ≈ 40 requêtes par seconde (limite du service : 50). */
const GEOCODING_BATCH = 5;
const GEOCODING_BATCH_MIN_MS = 125;

type Commune = { citycode: string; name: string; distance: number };

/**
 * Communes touchées par le cercle de recherche (géocodage inverse de points répartis dans le cercle),
 * de la plus proche du bien à la plus éloignée.
 */
async function communesAround(input: SearchInput): Promise<{ communes: Commune[]; geocodingDown: boolean; geocodingPartial: boolean }> {
  const found = new Map<string, Commune>();
  if (input.citycode) found.set(input.citycode, { citycode: input.citycode, name: input.city || input.citycode, distance: 0 });
  const points = samplePoints(input.latitude, input.longitude, input.radiusM);
  const budget = AbortSignal.timeout(GEOCODING_BUDGET_MS);
  let asked = 0;
  let answered = 0;
  for (let i = 0; i < points.length && !budget.aborted; i += GEOCODING_BATCH) {
    const started = Date.now();
    const batch = points.slice(i, i + GEOCODING_BATCH);
    asked += batch.length;
    const results = await Promise.all(batch.map(([lat, lon]) => reverseCommune(lat, lon, budget)));
    results.forEach((r, k) => {
      if (!r || !CITYCODE.test(r.citycode)) return;
      answered++;
      const distance = distanceMeters(input.latitude, input.longitude, batch[k][0], batch[k][1]);
      const known = found.get(r.citycode);
      if (!known) found.set(r.citycode, { citycode: r.citycode, name: r.city, distance });
      else if (distance < known.distance) known.distance = distance;
    });
    const wait = GEOCODING_BATCH_MIN_MS - (Date.now() - started);
    if (wait > 0 && i + GEOCODING_BATCH < points.length) await new Promise((resolve) => setTimeout(resolve, wait));
  }
  return {
    communes: [...found.values()].sort((a, b) => a.distance - b.distance),
    geocodingDown: answered === 0,
    geocodingPartial: answered > 0 && asked < points.length,
  };
}

/** « 2024 », « 2023 et 2025 », « 2022 à 2024 » */
function yearsLabel(years: number[]) {
  const sorted = [...years].sort((a, b) => a - b);
  if (sorted.length === 1) return String(sorted[0]);
  const contiguous = sorted.every((y, i) => i === 0 || y === sorted[i - 1] + 1);
  return contiguous ? `${sorted[0]} à ${sorted.at(-1)}` : `${sorted.slice(0, -1).join(", ")} et ${sorted.at(-1)}`;
}

/** Ventes comparables d'après les fichiers geo-dvf (source de repli). */
export async function findComparablesGeoDvf(
  input: SearchInput & { minDate: string },
  deadlineMs = SEARCH_DEADLINE_MS,
): Promise<{ comparables: Comparable[]; notes: string[] }> {
  const { communes, geocodingDown, geocodingPartial } = await communesAround(input);
  if (!communes.length) throw new DvfUnavailableError("Impossible de déterminer la commune du bien pour lire les données DVF.");
  // Commune du bien : celle de l'adresse, sinon celle du point géocodé le plus proche.
  const subject = communes[0];

  // Le délai des téléchargements commence après la recherche des communes. Les communes les plus proches
  // et les années les plus récentes passent en premier : ce sont les plus utiles si le délai est atteint.
  const deadline = AbortSignal.timeout(deadlineMs);
  const firstYear = Number(input.minDate.slice(0, 4));
  const lastYear = new Date().getFullYear();
  const jobs: [Commune, number][] = [];
  for (const c of communes) for (let y = lastYear; y >= firstYear; y--) jobs.push([c, y]);

  const sales: GeoSale[] = [];
  const failed = new Map<Commune, number[]>();
  const loaded = new Set<Commune>();
  for (let i = 0; i < jobs.length; i += 4) {
    const batch = jobs.slice(i, i + 4);
    const results = await Promise.allSettled(batch.map(([c, y]) => loadCommuneYear(c.citycode, y, deadline)));
    results.forEach((r, k) => {
      const [commune, year] = batch[k];
      if (r.status === "fulfilled") {
        sales.push(...r.value);
        loaded.add(commune);
      } else failed.set(commune, [...(failed.get(commune) ?? []), year]);
    });
  }

  // Sans aucune vente lue pour la commune du bien, le résultat n'aurait pas de sens : on s'arrête.
  if (!loaded.has(subject)) {
    if (deadline.aborted) throw new DvfTooLongError();
    throw new DvfUnavailableError("Les fichiers DVF de data.gouv.fr sont momentanément indisponibles.");
  }

  const notes: string[] = [];
  for (const [commune, years] of failed) {
    notes.push(`Ventes ${yearsLabel(years)} non chargées pour ${commune.name}${deadline.aborted ? " (délai dépassé)" : ""}.`);
  }
  if (geocodingDown) {
    notes.push("Communes voisines non identifiées (service de géocodage indisponible) : seules les ventes de la commune du bien sont prises en compte.");
  } else if (geocodingPartial) {
    notes.push("Le service de géocodage est lent : des communes voisines ont pu être oubliées.");
  }

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
