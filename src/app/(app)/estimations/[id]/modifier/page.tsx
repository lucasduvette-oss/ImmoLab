import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { NO_ADJUSTMENTS, computeEstimation, type Fees } from "@/lib/estimation";
import { getEstimation } from "@/lib/queries/estimations";
import { requireUser } from "@/lib/supabase/server";
import { EstimationEditor } from "../../estimation-editor";

export const metadata: Metadata = { title: "Modifier l'estimation" };

// La recherche DVF (action serveur de cette page) peut interroger deux sources successivement.
export const maxDuration = 120;

/** Reprise d'une estimation enregistrée (les comparables figés sont rechargés tels quels). */
export default async function EditEstimationPage({ params }: PageProps<"/estimations/[id]/modifier">) {
  const { id } = await params;
  const { supabase } = await requireUser();
  const e = await getEstimation(supabase, id);
  if (!e) notFound();

  const adjustments = { ...NO_ADJUSTMENTS, ...e.adjustments };
  const fees: Fees = { mode: e.fees_mode, value: e.fees_value, chargedTo: e.fees_charged_to };
  // Le prix conseillé enregistré n'est repris comme saisie manuelle que s'il diffère du prix calculé :
  // sinon, il doit suivre les nouveaux ajustements ou une nouvelle recherche.
  const computed = computeEstimation({ comparables: e.comparables, surface: e.surface, adjustments, fees });
  const recommendedOverride = e.recommended_price !== null && e.recommended_price !== computed?.recommendedPrice ? e.recommended_price : null;

  return (
    <>
      <PageHeader title="Modifier l'estimation" backHref={`/estimations/${id}`} />
      <EstimationEditor
        initial={{
          id: e.id,
          propertyId: e.property_id,
          subject: {
            type: e.property_type,
            address: e.address ?? "",
            postal_code: e.postal_code ?? "",
            city: e.city ?? "",
            citycode: e.citycode ?? "",
            latitude: e.latitude,
            longitude: e.longitude,
            surface: e.surface,
            rooms: e.rooms,
          },
          params: { radiusM: e.radius_m, periodYears: e.period_years, surfaceTolerancePct: e.surface_tolerance_pct },
          comparables: e.comparables,
          dataSource: e.data_source,
          adjustments,
          fees,
          recommendedOverride,
          arguments: e.arguments ?? "",
        }}
      />
    </>
  );
}
