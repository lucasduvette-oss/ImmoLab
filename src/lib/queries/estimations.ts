import type { SupabaseClient } from "@supabase/supabase-js";

import type { Adjustments, Comparable, EstimationPropertyType, Fees } from "@/lib/estimation";

/** Estimation telle qu'enregistrée en base (voir migration …_estimations.sql). */
export type EstimationRow = {
  id: string;
  property_id: string | null;
  property_type: EstimationPropertyType;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  citycode: string | null;
  latitude: number;
  longitude: number;
  surface: number;
  rooms: number | null;
  radius_m: number;
  period_years: number;
  surface_tolerance_pct: number;
  data_source: string | null;
  comparables: Comparable[];
  adjustments: Adjustments;
  comparables_count: number;
  median_price_sqm: number | null;
  low_value: number | null;
  mid_value: number | null;
  high_value: number | null;
  recommended_price: number | null;
  fees_mode: Fees["mode"];
  fees_value: number;
  fees_charged_to: Fees["chargedTo"];
  fees_amount: number | null;
  net_seller_price: number | null;
  arguments: string | null;
  created_at: string;
  updated_at: string;
};

export type EstimationListItem = Pick<
  EstimationRow,
  "id" | "property_id" | "property_type" | "address" | "postal_code" | "city" | "surface" | "rooms" | "recommended_price" | "net_seller_price" | "comparables_count" | "created_at"
>;

const LIST_COLUMNS = "id, property_id, property_type, address, postal_code, city, surface, rooms, recommended_price, net_seller_price, comparables_count, created_at";

/** Historique des estimations (toutes, ou celles d'un bien), de la plus récente à la plus ancienne. */
export async function listEstimations(supabase: SupabaseClient, propertyId?: string) {
  let query = supabase.from("estimations").select(LIST_COLUMNS).order("created_at", { ascending: false }).limit(200);
  if (propertyId) query = query.eq("property_id", propertyId);
  const { data, error } = await query.returns<EstimationListItem[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getEstimation(supabase: SupabaseClient, id: string) {
  const { data } = await supabase.from("estimations").select("*").eq("id", id).maybeSingle<EstimationRow>();
  return data;
}
