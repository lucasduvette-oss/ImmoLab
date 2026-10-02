import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { DEFAULT_SEARCH, NO_ADJUSTMENTS } from "@/lib/estimation";
import { propertyTitle } from "@/lib/property";
import { requireUser } from "@/lib/supabase/server";
import type { Property } from "@/lib/types";
import { EstimationEditor, type EditorInitial } from "../estimation-editor";

export const metadata: Metadata = { title: "Nouvelle estimation" };

/** Nouvelle estimation, pré-remplie depuis une fiche bien si l'adresse contient ?bien=<id>. */
export default async function NewEstimationPage({ searchParams }: PageProps<"/estimations/nouvelle">) {
  const { bien } = await searchParams;
  const { supabase } = await requireUser();
  const { data: property } =
    typeof bien === "string"
      ? await supabase.from("properties").select("*").eq("id", bien).maybeSingle<Property>()
      : { data: null };

  const initial: EditorInitial = {
    id: null,
    propertyId: property?.id ?? null,
    subject: {
      type: property?.type === "maison" ? "maison" : "appartement",
      address: property?.address ?? "",
      postal_code: property?.postal_code ?? "",
      city: property?.city ?? "",
      citycode: property?.citycode ?? "",
      latitude: property?.latitude ?? null,
      longitude: property?.longitude ?? null,
      surface: property?.surface ?? null,
      rooms: property?.rooms ?? null,
    },
    params: DEFAULT_SEARCH,
    comparables: [],
    dataSource: null,
    adjustments: NO_ADJUSTMENTS,
    // Honoraires du mandat repris s'ils sont connus, sinon à saisir.
    fees: property?.mandate_fees
      ? { mode: "montant", value: property.mandate_fees, chargedTo: "vendeur" }
      : { mode: "pourcentage", value: 0, chargedTo: "vendeur" },
    recommendedOverride: null,
    arguments: "",
  };

  return (
    <>
      <PageHeader
        title="Nouvelle estimation"
        description={property ? propertyTitle(property) : "Saisissez le bien à estimer"}
        backHref={property ? `/biens/${property.id}` : "/estimations"}
      />
      {property && !["appartement", "maison"].includes(property.type) && (
        <p className="mb-4 rounded-md bg-warning/20 px-3 py-2 text-sm text-amber-900">
          L&apos;estimation DVF ne concerne que les appartements et les maisons : choisissez le type le plus proche.
        </p>
      )}
      <EstimationEditor initial={initial} />
    </>
  );
}
