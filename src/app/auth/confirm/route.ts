import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

/**
 * Point d'arrivée des liens envoyés par email (confirmation d'inscription, mot de passe oublié).
 * Deux formats sont acceptés :
 *  - ?token_hash=…&type=… : format recommandé (fonctionne même si le lien est ouvert sur un autre appareil),
 *    il nécessite de modifier les modèles d'email dans Supabase (voir README) ;
 *  - ?code=… : format par défaut de Supabase (le lien doit être ouvert dans le même navigateur).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  // On n'autorise que les redirections internes (commençant par « / »).
  const nextParam = searchParams.get("next") ?? (type === "recovery" ? "/reinitialiser-mot-de-passe" : "/");
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";

  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, origin));
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }

  return NextResponse.redirect(new URL("/connexion?erreur=lien", origin));
}
