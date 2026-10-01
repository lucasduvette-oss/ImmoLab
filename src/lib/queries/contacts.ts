import type { SupabaseClient } from "@supabase/supabase-js";

import { BUYER_STAGES, CONTACT_ROLES, CONTACT_SOURCES, SELLER_STAGES } from "@/lib/constants";
import { normalizeSearch } from "@/lib/search";
import type { Contact } from "@/lib/types";

export type ContactFilters = {
  q?: string;
  role?: string;
  source?: string;
  stage?: string;
};

/** Liste des contacts de l'agent, avec recherche et filtres (les paramètres inconnus sont ignorés). */
export async function listContacts(supabase: SupabaseClient, filters: ContactFilters = {}) {
  let query = supabase.from("contacts").select("*").order("last_name").order("first_name").limit(500);

  if (filters.q) {
    const q = normalizeSearch(filters.q);
    if (q) query = query.ilike("search_text", `%${q}%`);
  }
  if (filters.role && filters.role in CONTACT_ROLES) {
    query = query.contains("roles", [filters.role]);
    if (filters.stage) {
      if (filters.role === "vendeur" && filters.stage in SELLER_STAGES) query = query.eq("seller_stage", filters.stage);
      if (filters.role === "acquereur" && filters.stage in BUYER_STAGES) query = query.eq("buyer_stage", filters.stage);
    }
  }
  if (filters.source && filters.source in CONTACT_SOURCES) query = query.eq("source", filters.source);

  const { data, error } = await query.returns<Contact[]>();
  if (error) throw new Error(error.message);
  return data;
}

/** Contacts pour un menu déroulant (ex. choisir le vendeur d'un bien). */
export async function listContactOptions(supabase: SupabaseClient, role?: string) {
  let query = supabase.from("contacts").select("id, first_name, last_name, roles").order("last_name").limit(1000);
  if (role) query = query.contains("roles", [role]);
  const { data, error } = await query.returns<Pick<Contact, "id" | "first_name" | "last_name" | "roles">[]>();
  if (error) throw new Error(error.message);
  return data;
}
