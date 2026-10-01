import type { SupabaseClient } from "@supabase/supabase-js";

import { fullName } from "@/lib/format";
import { propertyAddress, propertyTitle } from "@/lib/property";
import type { Property } from "@/lib/types";
import { listContactOptions } from "./contacts";

/** Contacts et biens proposés dans les menus « lier à » des tâches. */
export async function getLinkOptions(supabase: SupabaseClient) {
  const [contacts, { data: properties }] = await Promise.all([
    listContactOptions(supabase),
    supabase
      .from("properties")
      .select("id, type, rooms, surface, city, address, postal_code")
      .order("updated_at", { ascending: false })
      .limit(500)
      .returns<Pick<Property, "id" | "type" | "rooms" | "surface" | "city" | "address" | "postal_code">[]>(),
  ]);
  return {
    contacts: contacts.map((c) => ({ id: c.id, label: fullName(c) })),
    properties: (properties ?? []).map((p) => ({ id: p.id, label: `${propertyTitle(p)} — ${propertyAddress(p) || "sans adresse"}` })),
  };
}
