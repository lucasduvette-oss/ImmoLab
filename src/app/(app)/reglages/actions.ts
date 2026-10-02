"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { LOGOS_BUCKET } from "@/lib/constants";
import { requireUser } from "@/lib/supabase/server";
import { dbErrorMessage, str, zodFieldErrors, type FormState } from "@/lib/form";

const profileSchema = z.object({
  full_name: z.string().min(2, "Indiquez votre nom.").nullable(),
  phone: z.string().nullable(),
  email: z.email("Adresse email invalide.").nullable(),
  agency_name: z.string().nullable(),
  agency_address: z.string().nullable(),
});

/** Enregistre le profil de l'agent (nom, coordonnées, agence). */
export async function saveProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = profileSchema.safeParse({
    full_name: str(formData, "full_name"),
    phone: str(formData, "phone"),
    email: str(formData, "email"),
    agency_name: str(formData, "agency_name"),
    agency_address: str(formData, "agency_address"),
  });
  if (!parsed.success) return zodFieldErrors(parsed.error);

  const { supabase, userId } = await requireUser();
  const { error } = await supabase.from("profiles").upsert({ user_id: userId, ...parsed.data });
  if (error) return { error: dbErrorMessage(error) };

  revalidatePath("/", "layout");
  return { success: "Profil enregistré." };
}

/** Supprime du dossier de l'agent tous les fichiers de logo, sauf celui à garder (anciens logos, envois abandonnés). */
async function removeOtherLogos(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], userId: string, keep: string | null) {
  const { data: files } = await supabase.storage.from(LOGOS_BUCKET).list(userId, { limit: 100 });
  const unused = (files ?? []).map((f) => `${userId}/${f.name}`).filter((path) => path !== keep);
  if (unused.length) await supabase.storage.from(LOGOS_BUCKET).remove(unused);
}

/** Enregistre le logo déjà envoyé dans le stockage par le navigateur (et supprime les anciens). */
export async function setProfileLogo(storagePath: string) {
  const { supabase, userId } = await requireUser();
  // Le fichier doit être dans le dossier de l'agent, sans remonter dans l'arborescence.
  if (!storagePath.startsWith(`${userId}/`) || storagePath.includes("..")) return { error: "Emplacement de fichier invalide." };
  const { error } = await supabase.from("profiles").upsert({ user_id: userId, logo_path: storagePath });
  if (error) return { error: dbErrorMessage(error) };
  await removeOtherLogos(supabase, userId, storagePath);
  revalidatePath("/reglages");
  return { ok: true };
}

/** Retire le logo de l'agence. */
export async function removeProfileLogo() {
  const { supabase, userId } = await requireUser();
  const { error } = await supabase.from("profiles").update({ logo_path: null }).eq("user_id", userId);
  if (error) return { error: dbErrorMessage(error) };
  await removeOtherLogos(supabase, userId, null);
  revalidatePath("/reglages");
  return { ok: true };
}
