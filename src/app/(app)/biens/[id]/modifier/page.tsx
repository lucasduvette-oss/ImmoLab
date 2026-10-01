import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { listContactOptions } from "@/lib/queries/contacts";
import { requireUser } from "@/lib/supabase/server";
import type { Property } from "@/lib/types";
import { PropertyForm } from "../../property-form";

export const metadata: Metadata = { title: "Modifier le bien" };

export default async function EditPropertyPage({ params }: PageProps<"/biens/[id]/modifier">) {
  const { id } = await params;
  const { supabase } = await requireUser();
  const [{ data: property }, sellers] = await Promise.all([
    supabase.from("properties").select("*").eq("id", id).maybeSingle<Property>(),
    listContactOptions(supabase, "vendeur"),
  ]);
  if (!property) notFound();

  return (
    <>
      <PageHeader title="Modifier le bien" backHref={`/biens/${id}`} />
      <PropertyForm property={property} sellers={sellers} />
    </>
  );
}
