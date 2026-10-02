import type { Comparable } from "@/lib/estimation";

/** Résultat d'une recherche de ventes comparables, quelle que soit la source DVF. */
export type ComparablesResult = {
  comparables: Comparable[];
  source: string; // libellé affiché dans l'estimation et le rapport
  notice?: string; // information complémentaire pour l'agent
};

/**
 * Erreur « service DVF indisponible » : son message est affiché tel quel à l'agent.
 * `retryable` : une nouvelle tentative a-t-elle un sens (coupure passagère) ou non (fichier trop lourd) ?
 */
export class DvfUnavailableError extends Error {
  constructor(
    message: string,
    readonly retryable = true,
  ) {
    super(message);
    this.name = "DvfUnavailableError";
  }
}

/** Délai global de la recherche dépassé : le message invite à réduire le rayon ou la période. */
export class DvfTooLongError extends DvfUnavailableError {
  constructor() {
    super("La recherche des ventes DVF prend trop de temps : réduisez le rayon ou la période, puis réessayez.", false);
    this.name = "DvfTooLongError";
  }
}
