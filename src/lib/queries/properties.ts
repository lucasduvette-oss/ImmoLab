import type { SupabaseClient } from "@supabase/supabase-js";

import { PHOTOS_BUCKET, PROPERTY_STATUSES, PROPERTY_TYPES } from "@/lib/constants";
import { normalizeSearch } from "@/lib/search";
import type { Property, PropertyPhoto } from "@/lib/types";

/** Durée de validité des liens temporaires vers les photos (privées). */
const SIGNED_URL_SECONDS = 60 * 60;

/** Crée des liens temporaires (1 h) pour afficher des photos du stockage privé. */
export async function signPhotoUrls(supabase: SupabaseClient, paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data } = await supabase.storage.from(PHOTOS_BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
  const urls: Record<string, string> = {};
  for (const item of data ?? []) if (item.path && item.signedUrl) urls[item.path] = item.signedUrl;
  return urls;
}

export type PropertyFilters = { q?: string; status?: string; type?: string; mandat?: string };

export type PropertyListItem = Property & { coverUrl: string | null; seller: { first_name: string | null; last_name: string } | null };

/** Liste des biens de l'agent, avec la photo principale et le vendeur. */
export async function listProperties(supabase: SupabaseClient, filters: PropertyFilters = {}): Promise<PropertyListItem[]> {
  let query = supabase
    .from("properties")
    .select("*, property_photos(storage_path, position), seller:contacts(first_name, last_name)")
    .order("updated_at", { ascending: false })
    .limit(500);

  if (filters.status && filters.status in PROPERTY_STATUSES) query = query.eq("status", filters.status);
  if (filters.type && filters.type in PROPERTY_TYPES) query = query.eq("type", filters.type);
  if (filters.mandat === "echeance") {
    // Mandats arrivant à échéance dans les 30 jours (ou déjà échus) pour les biens actifs.
    const limit = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
    query = query.lte("mandate_end", limit).in("status", ["estimation", "en_vente", "sous_offre"]);
  }

  type Row = Property & {
    property_photos: Pick<PropertyPhoto, "storage_path" | "position">[];
    seller: { first_name: string | null; last_name: string } | { first_name: string | null; last_name: string }[] | null;
  };
  const { data, error } = await query.returns<Row[]>();
  if (error) throw new Error(error.message);

  let rows = data ?? [];
  if (filters.q) {
    const q = normalizeSearch(filters.q);
    const norm = (s: string | null) => (s ? normalizeSearch(s) : "");
    rows = rows.filter((p) => [p.address, p.city, p.postal_code, p.description].some((v) => norm(v).includes(q)));
  }

  const covers = rows.map((p) => [...p.property_photos].sort((a, b) => a.position - b.position)[0]?.storage_path).filter(Boolean) as string[];
  const urls = await signPhotoUrls(supabase, covers);

  return rows.map(({ property_photos, seller, ...p }) => {
    const cover = [...property_photos].sort((a, b) => a.position - b.position)[0];
    return {
      ...p,
      coverUrl: cover ? (urls[cover.storage_path] ?? null) : null,
      seller: Array.isArray(seller) ? (seller[0] ?? null) : seller,
    };
  });
}
