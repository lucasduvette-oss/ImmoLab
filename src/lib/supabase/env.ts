/**
 * Lecture des variables d'environnement Supabase.
 * Elles sont définies dans le fichier `.env.local` (en local) et dans les réglages du projet Vercel (en ligne).
 * Voir le README, section « Variables d'environnement ».
 */
export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Variables Supabase manquantes : renseignez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (voir README).",
    );
  }
  return { url, key };
}
