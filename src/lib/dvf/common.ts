import { flagOutliers, MAX_COMPARABLES, type Comparable } from "@/lib/estimation";
import { formatDate } from "@/lib/format";
import { DvfTooLongError, DvfUnavailableError } from "./types";

/** Lit un nombre reçu en texte (« 250000.00 ») ou en nombre ; vide ou invalide → null. */
export function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value.trim().replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Majuscules sans accents, pour comparer des libellés (« Vente », « UN APPARTEMENT »…). */
export function normalizeLabel(value: unknown): string {
  return typeof value === "string"
    ? value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .replace(/\s+/g, " ")
        .trim()
    : "";
}

/** Prix en dessous duquel une vente est considérée comme symbolique (ex. « 1 € »). */
export const MIN_SALE_PRICE = 1000;

/**
 * DVF ne couvre pas l'Alsace (67, 68), la Moselle (57) ni Mayotte (976) :
 * ces territoires relèvent du livre foncier et non du fichier de la DGFiP.
 */
export function assertCovered(citycode: string | null, postalCode: string | null) {
  const code = citycode || postalCode || "";
  if (/^(57|67|68)/.test(code) || code.startsWith("976")) {
    throw new DvfUnavailableError(
      "Les données DVF ne couvrent pas l'Alsace, la Moselle ni Mayotte (livre foncier) : estimation par les ventes DVF impossible pour ce secteur.",
    );
  }
}

/** Date limite basse de la période de recherche (AAAA-MM-JJ). */
export function periodStart(todayISO: string, periodYears: number): string {
  return `${Number(todayISO.slice(0, 4)) - periodYears}${todayISO.slice(4)}`;
}

/**
 * Finalise une liste de ventes : suppression des doublons, tri par distance,
 * repérage et pré-exclusion des prix au m² atypiques, message pour l'agent.
 */
export function finalizeComparables(found: Comparable[]): { comparables: Comparable[]; notes: string[] } {
  const unique = new Map<string, Comparable>();
  for (const c of found) if (!unique.has(c.id)) unique.set(c.id, c);
  const nearest = [...unique.values()].sort((a, b) => a.distance - b.distance);
  // Au-delà, l'écran et l'enregistrement deviendraient trop lourds : on garde les ventes les plus proches.
  const capped = nearest.length > MAX_COMPARABLES;
  const comparables = flagOutliers(nearest.slice(0, MAX_COMPARABLES)).map((c) => ({
    ...c,
    excluded: c.outlier,
  }));

  const notes: string[] = [];
  if (capped) {
    notes.push(
      `${nearest.length} ventes trouvées : seules les ${MAX_COMPARABLES} plus proches sont conservées (réduisez le rayon ou la période pour cibler davantage).`,
    );
  }
  const outliers = comparables.filter((c) => c.outlier).length;
  if (outliers) {
    notes.push(`${outliers} vente${outliers > 1 ? "s" : ""} au prix au m² atypique ${outliers > 1 ? "ont été pré-exclues" : "a été pré-exclue"} (vous pouvez les réintégrer).`);
  }
  if (comparables.length) {
    const lastDate = comparables.reduce((max, c) => (c.date > max ? c.date : max), "");
    notes.push(`Vente la plus récente trouvée : ${formatDate(lastDate)} (les données DVF sont publiées avec plusieurs mois de décalage).`);
  }
  return { comparables, notes };
}

/** Délai global d'une recherche de ventes, toutes requêtes confondues (en millisecondes). */
export const SEARCH_DEADLINE_MS = 45_000;

/**
 * Requête HTTP avec délai maximal et nouvelles tentatives sur 429 / 5xx (erreurs passagères).
 * - `deadline` : signal commun à toute la recherche (délai global) ;
 * - `retryNetworkErrors` : retente aussi après une coupure réseau ou un délai dépassé.
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit & { timeoutMs: number; retries?: number; retryNetworkErrors?: boolean; deadline?: AbortSignal },
): Promise<Response> {
  const { timeoutMs, retries = 2, retryNetworkErrors = false, deadline, ...fetchInit } = init;
  let lastStatus = 0;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (deadline?.aborted) throw tooLong();
    const timeout = AbortSignal.timeout(timeoutMs);
    let res: Response;
    try {
      res = await fetch(url, { ...fetchInit, signal: deadline ? AbortSignal.any([timeout, deadline]) : timeout });
    } catch {
      if (deadline?.aborted) throw tooLong();
      // Délai dépassé ou réseau injoignable : une seule nouvelle tentative au plus, si demandé.
      if (retryNetworkErrors && attempt < retries) {
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }
      throw new DvfUnavailableError("Le service de données DVF ne répond pas.");
    }
    if (res.ok || res.status === 404 || res.status === 400) return res;
    lastStatus = res.status;
    if (![429, 500, 502, 503, 504].includes(res.status)) break;
    if (attempt < retries) {
      const retryAfter = Number(res.headers.get("retry-after"));
      await new Promise((r) => setTimeout(r, Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 5) * 1000 : 800 * (attempt + 1)));
    }
  }
  throw new DvfUnavailableError(`Le service de données DVF a renvoyé une erreur (${lastStatus}).`);
}

function tooLong() {
  return new DvfTooLongError();
}

/**
 * Lit le corps d'une réponse en texte, avec une taille maximale.
 * Une coupure ou un délai dépassé pendant la lecture devient une DvfUnavailableError
 * (ce qui déclenche la source de repli, comme une absence de réponse).
 */
export async function readText(res: Response, maxBytes: number): Promise<string> {
  const declared = Number(res.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new DvfUnavailableError("Réponse du service DVF trop volumineuse.", false);
  try {
    if (!res.body) return await res.text();
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new DvfUnavailableError("Réponse du service DVF trop volumineuse.", false);
      }
      chunks.push(value);
    }
    return new TextDecoder().decode(Buffer.concat(chunks));
  } catch (e) {
    if (e instanceof DvfUnavailableError) throw e;
    throw new DvfUnavailableError("Le service de données DVF a interrompu sa réponse.");
  }
}

/** Lit une réponse JSON (taille maximale, erreurs de lecture ou JSON invalide → DvfUnavailableError). */
export async function readJson<T>(res: Response, maxBytes: number): Promise<T> {
  const text = await readText(res, maxBytes);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new DvfUnavailableError("Le service de données DVF a renvoyé une réponse illisible.");
  }
}
