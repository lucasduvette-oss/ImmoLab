"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  ENERGY_CLASSES,
  PHOTOS_BUCKET,
  MANDATE_TYPES,
  OUTDOOR_TYPES,
  PARKING_TYPES,
  PROPERTY_CONDITIONS,
  PROPERTY_STATUSES,
  PROPERTY_TYPES,
} from "@/lib/constants";
import { bool, dbErrorMessage, num, str, zodFieldErrors, type FormState } from "@/lib/form";
import { parisLocalToUTC } from "@/lib/format";
import { geocodeAddress } from "@/lib/geocoding";
import { requireUser } from "@/lib/supabase/server";

const keys = <T extends Record<string, string>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];
const amount = (label: string) => z.number({ error: `${label} : montant invalide.` }).min(0, `${label} : montant invalide.`).nullable();
const integer = (label: string) => z.number({ error: `${label} : nombre invalide.` }).int(`${label} : nombre entier attendu.`).nullable();

// ------------------------------------------------------------------ Bien

const propertySchema = z
  .object({
    type: z.enum(keys(PROPERTY_TYPES), { error: "Choisissez le type de bien." }),
    seller_contact_id: z.uuid().nullable(),
    address: z.string().nullable(),
    postal_code: z.string().regex(/^\d{5}$/, "Code postal : 5 chiffres.").nullable(),
    city: z.string().nullable(),
    citycode: z.string().nullable(),
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
    surface: z.number({ error: "Surface invalide." }).positive("Surface invalide.").nullable(),
    rooms: integer("Pièces").refine((v) => v === null || v >= 0, "Pièces : nombre invalide."),
    bedrooms: integer("Chambres").refine((v) => v === null || v >= 0, "Chambres : nombre invalide."),
    floor: integer("Étage"),
    has_elevator: z.boolean().nullable(),
    outdoor: z.enum(keys(OUTDOOR_TYPES)).nullable(),
    parking: z.enum(keys(PARKING_TYPES)).nullable(),
    construction_year: integer("Année").refine((v) => v === null || (v >= 1000 && v <= 2100), "Année invalide."),
    dpe: z.enum(ENERGY_CLASSES).nullable(),
    ges: z.enum(ENERGY_CLASSES).nullable(),
    condition: z.enum(keys(PROPERTY_CONDITIONS)).nullable(),
    price: amount("Prix"),
    charges_annual: amount("Charges"),
    property_tax: amount("Taxe foncière"),
    description: z.string().nullable(),
    status: z.enum(keys(PROPERTY_STATUSES)),
    mandate_type: z.enum(keys(MANDATE_TYPES)).nullable(),
    mandate_start: z.iso.date().nullable(),
    mandate_end: z.iso.date().nullable(),
    mandate_fees: amount("Honoraires"),
  })
  .refine((p) => !p.mandate_start || !p.mandate_end || p.mandate_end >= p.mandate_start, {
    message: "La date de fin doit être postérieure à la date de début.",
    path: ["mandate_end"],
  });

function yesNo(formData: FormData, name: string): boolean | null {
  const v = str(formData, name);
  return v === "oui" ? true : v === "non" ? false : null;
}

/** Crée ou modifie un bien, puis ouvre sa fiche. */
export async function saveProperty(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = propertySchema.safeParse({
    type: str(formData, "type"),
    seller_contact_id: str(formData, "seller_contact_id"),
    address: str(formData, "address"),
    postal_code: str(formData, "postal_code"),
    city: str(formData, "city"),
    citycode: str(formData, "citycode"),
    latitude: num(formData, "latitude"),
    longitude: num(formData, "longitude"),
    surface: num(formData, "surface"),
    rooms: num(formData, "rooms"),
    bedrooms: num(formData, "bedrooms"),
    floor: num(formData, "floor"),
    has_elevator: yesNo(formData, "has_elevator"),
    outdoor: str(formData, "outdoor"),
    parking: str(formData, "parking"),
    construction_year: num(formData, "construction_year"),
    dpe: str(formData, "dpe"),
    ges: str(formData, "ges"),
    condition: str(formData, "condition"),
    price: num(formData, "price"),
    charges_annual: num(formData, "charges_annual"),
    property_tax: num(formData, "property_tax"),
    description: str(formData, "description"),
    status: str(formData, "status") ?? "estimation",
    mandate_type: str(formData, "mandate_type"),
    mandate_start: str(formData, "mandate_start"),
    mandate_end: str(formData, "mandate_end"),
    mandate_fees: num(formData, "mandate_fees"),
  });
  if (!parsed.success) return zodFieldErrors(parsed.error);
  const data = parsed.data;

  // Adresse saisie à la main (sans choisir une suggestion) : on tente de la localiser côté serveur.
  if ((data.latitude === null || data.longitude === null) && data.address && (data.city || data.postal_code)) {
    const found = await geocodeAddress([data.address, data.postal_code, data.city].filter(Boolean).join(" "));
    if (found) {
      data.latitude = found.latitude;
      data.longitude = found.longitude;
      data.citycode = found.citycode || data.citycode;
    }
  }

  const { supabase } = await requireUser();
  const id = str(formData, "id");
  let propertyId = id;
  if (id) {
    const { error } = await supabase.from("properties").update(data).eq("id", id);
    if (error) return { error: dbErrorMessage(error) };
  } else {
    const { data: row, error } = await supabase.from("properties").insert(data).select("id").single();
    if (error) return { error: dbErrorMessage(error) };
    propertyId = row.id;
  }

  revalidatePath("/", "layout");
  redirect(`/biens/${propertyId}`);
}

/** Supprime un bien, ses photos (fichiers compris) et ses visites. */
export async function deleteProperty(propertyId: string) {
  const { supabase } = await requireUser();
  const { data: photos } = await supabase.from("property_photos").select("storage_path").eq("property_id", propertyId);
  if (photos?.length) await supabase.storage.from(PHOTOS_BUCKET).remove(photos.map((p) => p.storage_path));
  const { error } = await supabase.from("properties").delete().eq("id", propertyId);
  if (error) return { error: dbErrorMessage(error) };
  revalidatePath("/", "layout");
  redirect("/biens");
}

/** Change le statut d'un bien depuis sa fiche. */
export async function updatePropertyStatus(propertyId: string, status: string) {
  if (!(status in PROPERTY_STATUSES)) return { error: "Statut inconnu." };
  const { supabase } = await requireUser();
  const { error } = await supabase.from("properties").update({ status }).eq("id", propertyId);
  if (error) return { error: dbErrorMessage(error) };
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------------------------------------------------------------- Photos

/** Enregistre une photo déjà envoyée dans le stockage par le navigateur. */
export async function addPropertyPhoto(propertyId: string, storagePath: string) {
  const { supabase, userId } = await requireUser();
  // Le fichier doit se trouver dans le dossier de l'agent et du bien.
  if (!storagePath.startsWith(`${userId}/${propertyId}/`)) return { error: "Emplacement de fichier invalide." };
  const { data: last } = await supabase
    .from("property_photos")
    .select("position")
    .eq("property_id", propertyId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase
    .from("property_photos")
    .insert({ property_id: propertyId, storage_path: storagePath, position: (last?.position ?? -1) + 1 });
  if (error) return { error: dbErrorMessage(error) };
  revalidatePath(`/biens/${propertyId}`);
  return { ok: true };
}

export async function deletePropertyPhoto(photoId: string) {
  const { supabase } = await requireUser();
  const { data: photo } = await supabase.from("property_photos").select("storage_path, property_id").eq("id", photoId).maybeSingle();
  if (!photo) return { error: "Photo introuvable." };
  await supabase.storage.from(PHOTOS_BUCKET).remove([photo.storage_path]);
  const { error } = await supabase.from("property_photos").delete().eq("id", photoId);
  if (error) return { error: dbErrorMessage(error) };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Place une photo en première position (photo principale). */
export async function setCoverPhoto(photoId: string) {
  const { supabase } = await requireUser();
  const { data: photo } = await supabase.from("property_photos").select("property_id").eq("id", photoId).maybeSingle();
  if (!photo) return { error: "Photo introuvable." };
  const { data: photos } = await supabase
    .from("property_photos")
    .select("id")
    .eq("property_id", photo.property_id)
    .order("position")
    .order("created_at");
  const ordered = [photoId, ...(photos ?? []).map((p) => p.id).filter((id) => id !== photoId)];
  for (const [position, id] of ordered.entries()) {
    await supabase.from("property_photos").update({ position }).eq("id", id);
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

// --------------------------------------------------------------- Visites

const visitSchema = z.object({
  property_id: z.uuid(),
  buyer_contact_id: z.uuid({ error: "Choisissez l'acquéreur." }),
  visited_at: z.string({ error: "Indiquez la date de la visite." }),
  rating: z.number().int().min(1).max(5).nullable(),
  feedback: z.string().nullable(),
  feedback_sent_at: z.string().nullable(),
});

/** Ajoute ou modifie une visite (et son retour). */
export async function saveVisit(_prev: FormState, formData: FormData): Promise<FormState> {
  const local = str(formData, "visited_at");
  const sent = bool(formData, "feedback_sent");
  const parsed = visitSchema.safeParse({
    property_id: str(formData, "property_id"),
    buyer_contact_id: str(formData, "buyer_contact_id") ?? undefined,
    visited_at: local ? parisLocalToUTC(local) : undefined,
    rating: num(formData, "rating"),
    feedback: str(formData, "feedback"),
    // On conserve la date de transmission d'origine si la case était déjà cochée.
    feedback_sent_at: sent ? (str(formData, "feedback_sent_at") ?? new Date().toISOString()) : null,
  });
  if (!parsed.success) return zodFieldErrors(parsed.error);

  const { supabase } = await requireUser();
  const id = str(formData, "id");
  const { error } = id
    ? await supabase.from("visits").update(parsed.data).eq("id", id)
    : await supabase.from("visits").insert(parsed.data);
  if (error) return { error: dbErrorMessage(error) };

  revalidatePath("/", "layout");
  return { success: "Visite enregistrée." };
}

export async function deleteVisit(visitId: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("visits").delete().eq("id", visitId);
  if (error) return { error: dbErrorMessage(error) };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Indique que le retour de visite a été transmis au vendeur. */
export async function markFeedbackSent(visitId: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("visits").update({ feedback_sent_at: new Date().toISOString() }).eq("id", visitId);
  if (error) return { error: dbErrorMessage(error) };
  revalidatePath("/", "layout");
  return { ok: true };
}
