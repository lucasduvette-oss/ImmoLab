"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

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
