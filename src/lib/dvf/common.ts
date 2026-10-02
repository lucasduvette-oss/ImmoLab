import { flagOutliers, type Comparable } from "@/lib/estimation";
import { formatDate } from "@/lib/format";
import { DvfUnavailableError } from "./types";

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
        .replace(/[̀-ͯ]/g, "")
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
  const comparables = flagOutliers([...unique.values()].sort((a, b) => a.distance - b.distance)).map((c) => ({
    ...c,
    excluded: c.outlier,
  }));

  const notes: string[] = [];
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

/** Requête HTTP avec délai maximal et nouvelles tentatives sur 429 / 5xx (erreurs passagères). */
export async function fetchWithRetry(url: string, init: RequestInit & { timeoutMs: number; retries?: number }): Promise<Response> {
  const retries = init.retries ?? 2;
  let lastStatus = 0;
  for (let attempt = 0; attempt <= retries; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, { ...init, signal: AbortSignal.timeout(init.timeoutMs) });
    } catch {
      // Délai dépassé ou réseau injoignable : inutile d'insister.
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
