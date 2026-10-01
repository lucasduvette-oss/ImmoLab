import type { SupabaseClient } from "@supabase/supabase-js";

import type { MatchDetail } from "@/lib/matching";
import type { Contact, Property } from "@/lib/types";

export type MatchRow = {
  id: string;
  property_id: string;
  buyer_contact_id: string;
  score: number;
  details: MatchDetail[];
  seen_at: string | null;
  created_at: string;
  property: Pick<Property, "id" | "type" | "rooms" | "surface" | "city" | "address" | "postal_code" | "price" | "status">;
  buyer: Pick<Contact, "id" | "first_name" | "last_name" | "phone" | "buyer_stage">;
};

const SELECT =
  "id, property_id, buyer_contact_id, score, details, seen_at, created_at, " +
  "property:properties(id, type, rooms, surface, city, address, postal_code, price, status), " +
  "buyer:contacts(id, first_name, last_name, phone, buyer_stage)";

/** Nombre de nouvelles correspondances (badge de notification). */
export async function countNewMatches(supabase: SupabaseClient): Promise<number> {
  const { count } = await supabase.from("matches").select("id", { count: "exact", head: true }).is("seen_at", null);
  return count ?? 0;
}

/** Acquéreurs compatibles avec un bien, du meilleur score au moins bon. */
export async function matchesForProperty(supabase: SupabaseClient, propertyId: string) {
  const { data } = await supabase.from("matches").select(SELECT).eq("property_id", propertyId).order("score", { ascending: false }).returns<MatchRow[]>();
  return data ?? [];
}

/** Biens compatibles avec un acquéreur. */
export async function matchesForBuyer(supabase: SupabaseClient, contactId: string) {
  const { data } = await supabase.from("matches").select(SELECT).eq("buyer_contact_id", contactId).order("score", { ascending: false }).returns<MatchRow[]>();
  return data ?? [];
}

/** Toutes les correspondances : les nouvelles d'abord, puis les plus récentes. */
export async function listMatches(supabase: SupabaseClient, onlyNew = false) {
  let query = supabase.from("matches").select(SELECT).order("seen_at", { ascending: false, nullsFirst: true }).order("created_at", { ascending: false }).limit(300);
  if (onlyNew) query = query.is("seen_at", null);
  const { data } = await query.returns<MatchRow[]>();
  return data ?? [];
}
