"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { findComparables, DvfUnavailableError } from "@/lib/dvf";
import { computeEstimation, type Comparable } from "@/lib/estimation";
import {
  MAX_AMOUNT,
  MAX_PRICE_SQM,
  estimationPayloadSchema,
  searchSchema,
  type EstimationPayload,
  type SearchInput,
} from "@/lib/estimation-schema";
import { dbErrorMessage } from "@/lib/form";
import { requireUser } from "@/lib/supabase/server";

const round2 = (n: number) => Math.round(n * 100) / 100;

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
  // Valeurs arrondies comme en base (2 décimales) : le calcul refait plus tard à partir de la base
  // (page « Modifier ») retrouvera exactement le même prix conseillé.
  const surface = round2(p.surface);
  const fees = { ...p.fees, value: round2(p.fees.value) };

  // Le prix au m² de chaque vente et le résultat sont recalculés ici, à partir des prix et surfaces
  // transmis : les montants enregistrés sont ainsi toujours cohérents avec les ventes retenues.
  const comparables = p.comparables.map((c) => ({ ...c, pricePerSqm: c.price / c.surface }));
  const result = computeEstimation({
    comparables,
    surface,
    adjustments: p.adjustments,
    fees,
    recommendedOverride: p.recommendedOverride,
  });
  if (!result) return { error: "Retenez au moins une vente comparable." };
  const tooLarge =
    [result.low, result.mid, result.high, result.recommendedPrice, result.feesAmount].some((v) => !(Math.abs(v) <= MAX_AMOUNT)) ||
    !(result.medianPricePerSqm <= MAX_PRICE_SQM);
  if (tooLarge) return { error: "Les montants calculés sont trop élevés : vérifiez la surface et les ventes retenues." };

  const row = {
    property_id: p.property_id,
    property_type: p.type,
    address: p.address,
    postal_code: p.postal_code,
    city: p.city,
    citycode: p.citycode,
    latitude: p.latitude,
    longitude: p.longitude,
    surface,
    rooms: p.rooms,
    radius_m: p.radiusM,
    period_years: p.periodYears,
    surface_tolerance_pct: p.surfaceTolerancePct,
    data_source: p.data_source,
    comparables,
    adjustments: p.adjustments,
    comparables_count: result.count,
    median_price_sqm: result.medianPricePerSqm,
    low_value: result.low,
    mid_value: result.mid,
    high_value: result.high,
    recommended_price: result.recommendedPrice,
    fees_mode: p.fees.mode,
    fees_value: fees.value,
    fees_charged_to: p.fees.chargedTo,
    fees_amount: result.feesAmount,
    net_seller_price: result.netSellerPrice,
    arguments: p.arguments,
  };

  const { supabase } = await requireUser();
  let id = p.id;
  if (id) {
    const { data, error } = await supabase.from("estimations").update(row).eq("id", id).select("id").maybeSingle();
    if (error) return { error: dbErrorMessage(error) };
    // Aucune ligne modifiée : l'estimation a été supprimée entre-temps (sur un autre appareil, par exemple).
    if (!data) return { error: "Cette estimation n'existe plus (elle a peut-être été supprimée). Vos modifications n'ont pas été enregistrées." };
  } else {
    const { data, error } = await supabase.from("estimations").insert(row).select("id").single();
    if (error) return { error: dbErrorMessage(error) };
    id = data.id;
  }

  revalidatePath("/", "layout");
  redirect(`/estimations/${id}`);
}

export async function deleteEstimation(estimationId: string) {
  if (!z.uuid().safeParse(estimationId).success) return { error: "Estimation introuvable." };
  const { supabase } = await requireUser();
  const { error } = await supabase.from("estimations").delete().eq("id", estimationId);
  if (error) return { error: dbErrorMessage(error) };
  revalidatePath("/", "layout");
  redirect("/estimations");
}
