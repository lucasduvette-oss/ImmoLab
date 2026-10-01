import { createBrowserClient } from "@supabase/ssr";

/**
 * Client Supabase utilisé dans le navigateur (composants "use client").
 * Il sert surtout à l'envoi des photos et du logo directement vers le stockage Supabase.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
