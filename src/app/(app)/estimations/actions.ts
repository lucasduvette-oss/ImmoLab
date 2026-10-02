"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { findComparables, DvfUnavailableError } from "@/lib/dvf";
import { computeEstimation, type Comparable } from "@/lib/estimation";
import { estimationPayloadSchema, searchSchema, type EstimationPayload, type SearchInput } from "@/lib/estimation-schema";
import { dbErrorMessage } from "@/lib/form";
import { requireUser } from "@/lib/supabase/server";

/** Recherche les ventes comparables DVF autour du bien (appelée depuis l'écran d'estimation). */
export async function searchComparables(
  input: SearchInput,
): Promise<{ comparables: Comparable[]; source: string; notice?: string } | { error: string }> {
  await requireUser();
  const parsed = searchSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Paramètres de recherche invalides." };
  try {
    return await findComparables(parsed.data);
  } catch (e) {
    if (e instanceof DvfUnavailableError) return { error: e.message };
    console.error("Recherche DVF :", e);
    return { error: "La recherche des ventes DVF a échoué. Réessayez dans quelques instants." };
  }
}

/** Enregistre (ou met à jour) une estimation, puis ouvre sa page. */
export async function saveEstimation(payload: EstimationPayload): Promise<{ error: string } | void> {
  const parsed = estimationPayloadSchema.safeParse(payload);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Données d'estimation invalides." };
  const p = parsed.data;

  // Le résultat est recalculé côté serveur à partir des comparables retenus (on ne fait pas confiance au navigateur).
  const result = computeEstimation({
    comparables: p.comparables,
    surface: p.surface,
    adjustments: p.adjustments,
    fees: p.fees,
    recommendedOverride: p.recommendedOverride,
  });
  if (!result) return { error: "Retenez au moins une vente comparable." };

  const row = {
    property_id: p.property_id,
    property_type: p.type,
    address: p.address,
    postal_code: p.postal_code,
    city: p.city,
    citycode: p.citycode,
    latitude: p.latitude,
    longitude: p.longitude,
    surface: p.surface,
    rooms: p.rooms,
    radius_m: p.radiusM,
    period_years: p.periodYears,
    surface_tolerance_pct: p.surfaceTolerancePct,
    data_source: p.data_source,
    comparables: p.comparables,
    adjustments: p.adjustments,
    comparables_count: result.count,
    median_price_sqm: result.medianPricePerSqm,
    low_value: result.low,
    mid_value: result.mid,
    high_value: result.high,
    recommended_price: result.recommendedPrice,
    fees_mode: p.fees.mode,
    fees_value: p.fees.value,
    fees_charged_to: p.fees.chargedTo,
    fees_amount: result.feesAmount,
    net_seller_price: result.netSellerPrice,
    arguments: p.arguments,
  };

  const { supabase } = await requireUser();
  let id = p.id;
  if (id) {
    const { error } = await supabase.from("estimations").update(row).eq("id", id);
    if (error) return { error: dbErrorMessage(error) };
  } else {
    const { data, error } = await supabase.from("estimations").insert(row).select("id").single();
    if (error) return { error: dbErrorMessage(error) };
    id = data.id;
  }

  revalidatePath("/", "layout");
  redirect(`/estimations/${id}`);
}

export async function deleteEstimation(estimationId: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("estimations").delete().eq("id", estimationId);
  if (error) return { error: dbErrorMessage(error) };
  revalidatePath("/", "layout");
  redirect("/estimations");
}
