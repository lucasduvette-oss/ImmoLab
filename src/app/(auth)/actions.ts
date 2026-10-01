"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { zodFieldErrors, type FormState } from "@/lib/form";

const credentialsSchema = z.object({
  email: z.email("Adresse email invalide."),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères."),
});

/** Adresse du site (http://localhost:3000 en local, https://….vercel.app en ligne). */
async function siteOrigin() {
  const h = await headers();
  return h.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

/** Traduit les messages d'erreur de Supabase Auth les plus courants. */
function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Email ou mot de passe incorrect.";
  if (m.includes("email not confirmed")) return "Votre adresse email n'est pas encore confirmée : cliquez sur le lien reçu par email.";
  if (m.includes("already registered") || m.includes("already been registered")) return "Un compte existe déjà avec cette adresse email.";
  if (m.includes("signups not allowed") || m.includes("signup is disabled")) return "Les inscriptions sont fermées sur cette application.";
  if (m.includes("rate limit")) return "Trop de tentatives. Patientez quelques minutes avant de réessayer.";
  if (m.includes("password")) return "Mot de passe refusé : choisissez un mot de passe plus long ou plus complexe.";
  return `Erreur : ${message}`;
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = credentialsSchema
    .extend({ password: z.string().min(1, "Indiquez votre mot de passe.") })
    .safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return zodFieldErrors(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: translateAuthError(error.message) };
  redirect("/");
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = credentialsSchema
    .extend({ fullName: z.string().trim().min(2, "Indiquez votre nom.") })
    .safeParse({ email: formData.get("email"), password: formData.get("password"), fullName: formData.get("fullName") });
  if (!parsed.success) return zodFieldErrors(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // Le nom est recopié dans le profil de l'agent par un déclencheur de la base (voir migration).
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${await siteOrigin()}/auth/confirm`,
    },
  });
  if (error) return { error: translateAuthError(error.message) };

  // Si la confirmation par email est désactivée dans Supabase, l'utilisateur est connecté immédiatement.
  if (data.session) redirect("/");
  return {
    success: "Compte créé ! Ouvrez l'email de confirmation que vous venez de recevoir, puis connectez-vous.",
  };
}

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z.object({ email: z.email("Adresse email invalide.") }).safeParse({ email: formData.get("email") });
  if (!parsed.success) return zodFieldErrors(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await siteOrigin()}/auth/confirm?next=/reinitialiser-mot-de-passe`,
  });
  if (error) return { error: translateAuthError(error.message) };
  return { success: "Si un compte existe avec cette adresse, un email de réinitialisation vient d'être envoyé." };
}

export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({
      password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères."),
      confirm: z.string(),
    })
    .refine((v) => v.password === v.confirm, { message: "Les deux mots de passe ne correspondent pas.", path: ["confirm"] })
    .safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) return zodFieldErrors(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: translateAuthError(error.message) };
  return { success: "Mot de passe modifié." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/connexion");
}
