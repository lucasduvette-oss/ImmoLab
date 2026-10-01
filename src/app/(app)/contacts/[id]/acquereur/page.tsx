import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { fullName } from "@/lib/format";
import { requireUser } from "@/lib/supabase/server";
import type { BuyerProfile } from "@/lib/types";
import { BuyerForm } from "./buyer-form";

export const metadata: Metadata = { title: "Projet d'achat" };

export default async function BuyerProfilePage({ params }: PageProps<"/contacts/[id]/acquereur">) {
  const { id } = await params;
  const { supabase } = await requireUser();
  const [{ data: contact }, { data: profile }] = await Promise.all([
    supabase.from("contacts").select("id, first_name, last_name").eq("id", id).maybeSingle(),
    supabase.from("buyer_profiles").select("*").eq("contact_id", id).maybeSingle<BuyerProfile>(),
  ]);
  if (!contact) notFound();

  return (
    <>
      <PageHeader title="Projet d'achat" description={fullName(contact)} backHref={`/contacts/${id}`} />
      <BuyerForm contactId={id} profile={profile} />
    </>
  );
}
