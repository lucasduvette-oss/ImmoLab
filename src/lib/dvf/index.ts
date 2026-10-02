import "server-only";

import type { Comparable } from "@/lib/estimation";
import type { SearchInput } from "@/lib/estimation-schema";
import { todayISO } from "@/lib/format";
import { CEREMA_SOURCE, findComparablesCerema } from "./cerema";
import { assertCovered, finalizeComparables, periodStart } from "./common";
import { findComparablesGeoDvf, GEODVF_SOURCE } from "./geodvf";
import { DvfUnavailableError, type ComparablesResult } from "./types";

export { DvfUnavailableError, type ComparablesResult } from "./types";

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
      return await findComparablesGeoDvf(query);
    } catch (e) {
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
      const result = await findComparablesCerema(query);
      found = result.comparables;
      source = CEREMA_SOURCE;
      if (result.truncated) notes.push("Zone très dense : toutes les ventes n'ont pas pu être lues, réduisez le rayon ou la période.");
    } catch (e) {
      if (!(e instanceof DvfUnavailableError)) throw e;
      console.warn("API DVF du Cerema indisponible, bascule sur geo-dvf :", e.message);
      found = await fromGeoDvf();
      source = GEODVF_SOURCE;
      notes.push("Le service DVF du Cerema ne répond pas : les ventes proviennent des fichiers DVF géolocalisés de data.gouv.fr.");
    }
  }

  const { comparables, notes: more } = finalizeComparables(found);
  return { comparables, source, notice: [...notes, ...more].join(" ") || undefined };
}
