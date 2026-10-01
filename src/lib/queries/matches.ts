import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Nombre de nouvelles correspondances biens / acquéreurs (badge de notification).
 * Le rapprochement arrive à l'étape 4 : pour l'instant, aucune correspondance.
 */
export async function countNewMatches(_supabase: SupabaseClient): Promise<number> {
  return 0;
}
