"use server";

import { revalidatePath } from "next/cache";

import { dbErrorMessage } from "@/lib/form";
import { requireUser } from "@/lib/supabase/server";

/** Marque des correspondances comme vues (sans liste d'identifiants : toutes les nouvelles). */
export async function markMatchesSeen(ids?: string[]) {
  const { supabase } = await requireUser();
  let query = supabase.from("matches").update({ seen_at: new Date().toISOString() }).is("seen_at", null);
  if (ids?.length) query = query.in("id", ids);
  const { error } = await query;
  if (error) return { error: dbErrorMessage(error) };
  revalidatePath("/", "layout");
  return { ok: true };
}
