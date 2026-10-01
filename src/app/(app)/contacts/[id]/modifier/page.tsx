import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/supabase/server";
import type { Contact } from "@/lib/types";
import { ContactForm } from "../../contact-form";

export const metadata: Metadata = { title: "Modifier le contact" };

export default async function EditContactPage({ params }: PageProps<"/contacts/[id]/modifier">) {
  const { id } = await params;
  const { supabase } = await requireUser();
  const { data: contact } = await supabase.from("contacts").select("*").eq("id", id).maybeSingle<Contact>();
  if (!contact) notFound();

  return (
    <>
      <PageHeader title="Modifier le contact" backHref={`/contacts/${id}`} />
      <ContactForm contact={contact} />
    </>
  );
}
