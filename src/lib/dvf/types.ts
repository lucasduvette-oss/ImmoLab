import type { Comparable } from "@/lib/estimation";

/** Résultat d'une recherche de ventes comparables, quelle que soit la source DVF. */
export type ComparablesResult = {
  comparables: Comparable[];
  source: string; // libellé affiché dans l'estimation et le rapport
  notice?: string; // information complémentaire pour l'agent
};

/** Erreur « service DVF indisponible » : son message est affiché tel quel à l'agent. */
export class DvfUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DvfUnavailableError";
  }
}
