import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { listContactOptions } from "@/lib/queries/contacts";
import { requireUser } from "@/lib/supabase/server";
import { PropertyForm } from "../property-form";

export const metadata: Metadata = { title: "Nouveau bien" };

export default async function NewPropertyPage({ searchParams }: PageProps<"/biens/nouveau">) {
  const { vendeur } = await searchParams;
  const { supabase } = await requireUser();
  const sellers = await listContactOptions(supabase, "vendeur");

  return (
    <>
      <PageHeader title="Nouveau bien" backHref="/biens" />
      <PropertyForm sellers={sellers} defaultSellerId={typeof vendeur === "string" ? vendeur : undefined} />
    </>
  );
}
