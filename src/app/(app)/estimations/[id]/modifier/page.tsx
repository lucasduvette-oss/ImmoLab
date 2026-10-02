import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { NO_ADJUSTMENTS } from "@/lib/estimation";
import { getEstimation } from "@/lib/queries/estimations";
import { requireUser } from "@/lib/supabase/server";
import { EstimationEditor } from "../../estimation-editor";

export const metadata: Metadata = { title: "Modifier l'estimation" };

/** Reprise d'une estimation enregistrée (les comparables figés sont rechargés tels quels). */
export default async function EditEstimationPage({ params }: PageProps<"/estimations/[id]/modifier">) {
  const { id } = await params;
  const { supabase } = await requireUser();
  const e = await getEstimation(supabase, id);
  if (!e) notFound();

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
          adjustments: { ...NO_ADJUSTMENTS, ...e.adjustments },
          fees: { mode: e.fees_mode, value: e.fees_value, chargedTo: e.fees_charged_to },
          // Le prix conseillé enregistré est conservé s'il différait de la valeur calculée.
          recommendedOverride: e.recommended_price,
          arguments: e.arguments ?? "",
        }}
      />
    </>
  );
}
