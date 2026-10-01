import { MUST_HAVES, PROPERTY_TYPES, type MustHave, type PropertyType } from "./constants";
import { formatEuros, formatNumber, formatSurface } from "./format";

/**
 * Détail d'un critère de correspondance, tel que calculé par la base
 * (fonction SQL match_property_buyer, voir supabase/migrations/…_matches.sql).
 * ok = true (respecté), false (non respecté), null (information manquante).
 */
export type MatchDetail = {
  key: "type" | "secteur" | "prix" | "surface" | "pieces" | MustHave;
  ok: boolean | null;
  value?: string | number;
  target?: number;
};

/** Libellé lisible d'un critère : « Prix 315 000 € (budget 320 000 €) ». */
export function matchDetailLabel(d: MatchDetail): string {
  switch (d.key) {
    case "type":
      return PROPERTY_TYPES[d.value as PropertyType] ?? "Type";
    case "secteur":
      return `Secteur : ${d.value ?? "—"}`;
    case "prix":
      if (d.ok === null) return "Prix non renseigné";
      return `Prix ${formatEuros(Number(d.value))} (budget ${formatEuros(d.target)})`;
    case "surface":
      if (d.ok === null) return "Surface non renseignée";
      return `${formatSurface(Number(d.value))} (min. ${formatSurface(d.target)})`;
    case "pieces":
      if (d.ok === null) return "Pièces non renseignées";
      return `${formatNumber(Number(d.value))} pièces (min. ${formatNumber(d.target)})`;
    default:
      return MUST_HAVES[d.key]?.split(" (")[0] ?? d.key;
  }
}

/** Couleur du score : vert ≥ 85, orange ≥ 70, gris en dessous. */
export function scoreTone(score: number): "high" | "medium" | "low" {
  return score >= 85 ? "high" : score >= 70 ? "medium" : "low";
}
