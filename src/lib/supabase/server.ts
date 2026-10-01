import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { getSupabaseEnv } from "./env";

/**
 * Client Supabase côté serveur (pages, Server Actions, routes API).
 * Il lit la session de l'utilisateur dans les cookies : toutes les requêtes sont donc faites
 * « au nom » de l'agent connecté, et les règles RLS de la base filtrent ses données.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, key } = getSupabaseEnv();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Appelé depuis un composant serveur (lecture seule) : sans importance,
          // le proxy (src/proxy.ts) se charge de rafraîchir la session.
        }
      },
    },
  });
}

/**
 * Renvoie l'utilisateur connecté ou redirige vers la page de connexion.
 * Mis en cache pour la durée d'une requête (plusieurs composants peuvent l'appeler).
 */
export const requireUser = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) redirect("/connexion");
  return { supabase, userId: data.claims.sub as string, email: (data.claims.email as string) ?? "" };
});
