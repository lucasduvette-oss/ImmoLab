"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { dbErrorMessage, str, zodFieldErrors, type FormState } from "@/lib/form";
import { todayISO } from "@/lib/format";
import { requireUser } from "@/lib/supabase/server";

const taskSchema = z.object({
  title: z.string({ error: "Indiquez l'intitulé de la tâche." }).min(1, "Indiquez l'intitulé de la tâche."),
  notes: z.string().nullable(),
  due_date: z.iso.date({ error: "Indiquez une date d'échéance." }),
  contact_id: z.uuid().nullable(),
  property_id: z.uuid().nullable(),
});

/** Crée ou modifie une tâche. */
export async function saveTask(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = taskSchema.safeParse({
    title: str(formData, "title") ?? undefined,
    notes: str(formData, "notes"),
    due_date: str(formData, "due_date") ?? undefined,
    contact_id: str(formData, "contact_id"),
    property_id: str(formData, "property_id"),
  });
  if (!parsed.success) return zodFieldErrors(parsed.error);

  const { supabase } = await requireUser();
  const id = str(formData, "id");
  const { error } = id
    ? await supabase.from("tasks").update(parsed.data).eq("id", id)
    : await supabase.from("tasks").insert(parsed.data);
  if (error) return { error: dbErrorMessage(error) };

  revalidatePath("/", "layout");
  return { success: "Tâche enregistrée." };
}

/** Coche / décoche une tâche. */
export async function setTaskDone(taskId: string, done: boolean) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("tasks")
    .update({ done_at: done ? new Date().toISOString() : null })
    .eq("id", taskId);
  if (error) return { error: dbErrorMessage(error) };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteTask(taskId: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) return { error: dbErrorMessage(error) };
  revalidatePath("/", "layout");
  return { ok: true };
}

const suggestionSchema = z.object({
  key: z.string().min(1).max(200),
  title: z.string().min(1).max(300),
  notes: z.string().max(1000),
  contactId: z.uuid().nullable(),
  propertyId: z.uuid().nullable(),
});

/** Transforme une relance suggérée en tâche pour aujourd'hui (une seule fois par relance). */
export async function createTaskFromSuggestion(suggestion: z.infer<typeof suggestionSchema>) {
  const parsed = suggestionSchema.safeParse(suggestion);
  if (!parsed.success) return { error: "Relance invalide." };
  const s = parsed.data;
  const { supabase } = await requireUser();
  const { error } = await supabase.from("tasks").insert({
    title: s.title,
    notes: s.notes,
    due_date: todayISO(),
    contact_id: s.contactId,
    property_id: s.propertyId,
    suggestion_key: s.key,
  });
  // 23505 : la relance a déjà été transformée en tâche (autre onglet, autre appareil) — rien à faire.
  if (error && error.code !== "23505") return { error: dbErrorMessage(error) };
  revalidatePath("/", "layout");
  return { ok: true };
}
