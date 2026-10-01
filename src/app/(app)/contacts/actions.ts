"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  BUYER_STAGES,
  CONTACT_ROLES,
  CONTACT_SOURCES,
  INTERACTION_KINDS,
  MUST_HAVES,
  PARTNER_TYPES,
  PROPERTY_TYPES,
  SELLER_STAGES,
  TIMEFRAMES,
} from "@/lib/constants";
import { dbErrorMessage, list, num, str, zodFieldErrors, type FormState } from "@/lib/form";
import { parisLocalToUTC } from "@/lib/format";
import { requireUser } from "@/lib/supabase/server";

const keys = <T extends Record<string, string>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];

// ------------------------------------------------------------------ Contact

const contactSchema = z.object({
  first_name: z.string().nullable(),
  last_name: z.string({ error: "Le nom est obligatoire." }).min(1, "Le nom est obligatoire."),
  phone: z.string().nullable(),
  email: z.email("Adresse email invalide.").nullable(),
  address: z.string().nullable(),
  postal_code: z
    .string()
    .regex(/^\d{5}$/, "Code postal : 5 chiffres.")
    .nullable(),
  city: z.string().nullable(),
  source: z.enum(keys(CONTACT_SOURCES)).nullable(),
  notes: z.string().nullable(),
  roles: z.array(z.enum(keys(CONTACT_ROLES))),
  partner_type: z.enum(keys(PARTNER_TYPES)).nullable(),
});

/** Crée ou modifie un contact, puis ouvre sa fiche. */
export async function saveContact(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = contactSchema.safeParse({
    first_name: str(formData, "first_name"),
    last_name: str(formData, "last_name"),
    phone: str(formData, "phone"),
    email: str(formData, "email"),
    address: str(formData, "address"),
    postal_code: str(formData, "postal_code"),
    city: str(formData, "city"),
    source: str(formData, "source"),
    notes: str(formData, "notes"),
    roles: list(formData, "roles"),
    partner_type: str(formData, "partner_type"),
  });
  if (!parsed.success) return zodFieldErrors(parsed.error);

  const { supabase } = await requireUser();
  const id = str(formData, "id");
  let contactId = id;

  if (id) {
    const { error } = await supabase.from("contacts").update(parsed.data).eq("id", id);
    if (error) return { error: dbErrorMessage(error) };
  } else {
    const { data, error } = await supabase.from("contacts").insert(parsed.data).select("id").single();
    if (error) return { error: dbErrorMessage(error) };
    contactId = data.id;
  }

  revalidatePath("/contacts", "layout");
  redirect(`/contacts/${contactId}`);
}

export async function deleteContact(contactId: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("contacts").delete().eq("id", contactId);
  if (error) return { error: dbErrorMessage(error) };
  revalidatePath("/", "layout");
  redirect("/contacts");
}

/** Change l'étape d'un contact dans un pipeline (glisser-déposer du Kanban ou menu de la fiche). */
export async function updateContactStage(contactId: string, pipeline: "vendeur" | "acquereur", stage: string) {
  const column = pipeline === "vendeur" ? "seller_stage" : "buyer_stage";
  const allowed = pipeline === "vendeur" ? SELLER_STAGES : BUYER_STAGES;
  if (!(stage in allowed)) return { error: "Étape inconnue." };

  const { supabase } = await requireUser();
  const { error } = await supabase.from("contacts").update({ [column]: stage }).eq("id", contactId);
  if (error) return { error: dbErrorMessage(error) };
  revalidatePath("/", "layout");
  return { ok: true };
}

// ------------------------------------------------------- Profil acquéreur

const buyerSchema = z.object({
  budget_max: z.number({ error: "Montant invalide." }).min(0).nullable(),
  financing_approved: z.boolean().nullable(),
  down_payment: z.number({ error: "Montant invalide." }).min(0).nullable(),
  timeframe: z.enum(keys(TIMEFRAMES)).nullable(),
  needs_prior_sale: z.boolean().nullable(),
  motivation: z.number().int().min(1).max(5).nullable(),
  property_types: z.array(z.enum(keys(PROPERTY_TYPES))),
  locations: z.array(z.string()),
  min_surface: z.number({ error: "Surface invalide." }).min(0).nullable(),
  min_rooms: z.number({ error: "Nombre invalide." }).int("Nombre entier attendu.").min(0).nullable(),
  must_haves: z.array(z.enum(keys(MUST_HAVES))),
});

/** Lit un choix Oui / Non / Non renseigné. */
function yesNo(formData: FormData, name: string): boolean | null {
  const v = str(formData, name);
  return v === "oui" ? true : v === "non" ? false : null;
}

/** Enregistre la qualification et les critères de recherche d'un acquéreur. */
export async function saveBuyerProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const contactId = str(formData, "contact_id");
  if (!contactId) return { error: "Contact introuvable." };

  const parsed = buyerSchema.safeParse({
    budget_max: num(formData, "budget_max"),
    financing_approved: yesNo(formData, "financing_approved"),
    down_payment: num(formData, "down_payment"),
    timeframe: str(formData, "timeframe"),
    needs_prior_sale: yesNo(formData, "needs_prior_sale"),
    motivation: num(formData, "motivation"),
    property_types: list(formData, "property_types"),
    // « Nantes, 44300 ; Rezé » → ["Nantes", "44300", "Rezé"]
    locations: (str(formData, "locations") ?? "")
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean),
    min_surface: num(formData, "min_surface"),
    min_rooms: num(formData, "min_rooms"),
    must_haves: list(formData, "must_haves"),
  });
  if (!parsed.success) return zodFieldErrors(parsed.error);

  const { supabase } = await requireUser();
  const { error } = await supabase.from("buyer_profiles").upsert({ contact_id: contactId, ...parsed.data });
  if (error) return { error: dbErrorMessage(error) };

  revalidatePath("/", "layout");
  redirect(`/contacts/${contactId}`);
}

// -------------------------------------------------------------- Échanges

const interactionSchema = z.object({
  contact_id: z.uuid(),
  kind: z.enum(keys(INTERACTION_KINDS), { error: "Choisissez un type d'échange." }),
  occurred_at: z.string({ error: "Indiquez la date." }),
  content: z.string().nullable(),
});

/** Ajoute (ou modifie) un échange dans la timeline d'un contact. */
export async function saveInteraction(_prev: FormState, formData: FormData): Promise<FormState> {
  const local = str(formData, "occurred_at");
  const parsed = interactionSchema.safeParse({
    contact_id: str(formData, "contact_id"),
    kind: str(formData, "kind"),
    occurred_at: local ? parisLocalToUTC(local) : undefined,
    content: str(formData, "content"),
  });
  if (!parsed.success) return zodFieldErrors(parsed.error);

  const { supabase } = await requireUser();
  const id = str(formData, "id");
  const { error } = id
    ? await supabase.from("interactions").update(parsed.data).eq("id", id)
    : await supabase.from("interactions").insert(parsed.data);
  if (error) return { error: dbErrorMessage(error) };

  revalidatePath("/", "layout");
  return { success: "Échange enregistré." };
}

export async function deleteInteraction(interactionId: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("interactions").delete().eq("id", interactionId);
  if (error) return { error: dbErrorMessage(error) };
  revalidatePath("/", "layout");
  return { ok: true };
}
