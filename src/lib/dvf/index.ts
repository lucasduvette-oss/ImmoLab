import "server-only";

import type { Comparable } from "@/lib/estimation";
import type { SearchInput } from "@/lib/estimation-schema";
import { todayISO } from "@/lib/format";
import { CEREMA_SOURCE, findComparablesCerema } from "./cerema";
import { assertCovered, finalizeComparables, periodStart, SEARCH_DEADLINE_MS } from "./common";
import { findComparablesGeoDvf, GEODVF_SOURCE } from "./geodvf";
import { DvfTooLongError, DvfUnavailableError, type ComparablesResult } from "./types";

export { DvfTooLongError, DvfUnavailableError, type ComparablesResult } from "./types";

/**
 * Recherche des ventes comparables DVF.
 * 1. Source principale : API du Cerema (DVF+ open data).
 * 2. Si elle ne répond pas : fichiers « DVF géolocalisées » d'Etalab (data.gouv.fr).
 * La variable d'environnement DVF_SOURCE=geodvf permet d'utiliser directement la source de repli.
 */
export async function findComparables(input: SearchInput): Promise<ComparablesResult> {
  assertCovered(input.citycode, input.postal_code);
  const query = { ...input, minDate: periodStart(todayISO(), input.periodYears) };
  const notes: string[] = [];
  let found: Comparable[];
  let source: string;

  const fromGeoDvf = async () => {
    try {
      // La source de repli gère ses propres délais (recherche des communes, puis téléchargements).
      const result = await findComparablesGeoDvf(query);
      notes.push(...result.notes);
      return result.comparables;
    } catch (e) {
      // Délai dépassé : le message (réduire le rayon ou la période) est plus utile que « indisponible ».
      if (e instanceof DvfTooLongError) throw e;
      if (e instanceof DvfUnavailableError) {
        throw new DvfUnavailableError("Les services de données DVF (Cerema et data.gouv.fr) sont momentanément indisponibles. Réessayez plus tard.");
      }
      throw e;
    }
  };

  if (process.env.DVF_SOURCE === "geodvf") {
    found = await fromGeoDvf();
    source = GEODVF_SOURCE;
  } else {
    try {
      const result = await findComparablesCerema(query, AbortSignal.timeout(SEARCH_DEADLINE_MS));
      found = result.comparables;
      source = CEREMA_SOURCE;
      if (result.truncated) {
        notes.push("Toutes les ventes n'ont pas pu être lues (zone très dense ou service lent) : réduisez le rayon ou la période pour un résultat complet.");
      }
    } catch (e) {
      if (!(e instanceof DvfUnavailableError)) throw e;
      console.warn("API DVF du Cerema indisponible, bascule sur geo-dvf :", e.message);
      notes.push("Le service DVF du Cerema ne répond pas : les ventes proviennent des fichiers DVF géolocalisés de data.gouv.fr.");
      found = await fromGeoDvf();
      source = GEODVF_SOURCE;
    }
  }

  const { comparables, notes: more } = finalizeComparables(found);
  return { comparables, source, notice: [...notes, ...more].join(" ") || undefined };
}
