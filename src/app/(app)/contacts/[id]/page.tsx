import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MailIcon, MapPinIcon, PencilIcon, PhoneIcon, SearchIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { RoleBadges } from "@/components/contact-badges";
import { ContactActions } from "@/components/contact-actions";
import { ConfirmButton } from "@/components/confirm-button";
import { CONTACT_SOURCES } from "@/lib/constants";
import { formatPhone, fullName } from "@/lib/format";
import { requireUser } from "@/lib/supabase/server";
import type { BuyerProfile, Contact, Interaction } from "@/lib/types";
import { deleteContact } from "../actions";
import { BuyerSummary } from "./buyer-summary";
import { InteractionDialog } from "./interaction-dialog";
import { StageSelect } from "./stage-select";
import { Timeline, type TimelineItem } from "./timeline";

export async function generateMetadata({ params }: PageProps<"/contacts/[id]">): Promise<Metadata> {
  const { id } = await params;
  const { supabase } = await requireUser();
  const { data } = await supabase.from("contacts").select("first_name, last_name").eq("id", id).maybeSingle();
  return { title: data ? fullName(data) : "Contact" };
}

export default async function ContactPage({ params }: PageProps<"/contacts/[id]">) {
  const { id } = await params;
  const { supabase } = await requireUser();

  const [{ data: contact }, { data: buyer }, { data: interactions }] = await Promise.all([
    supabase.from("contacts").select("*").eq("id", id).maybeSingle<Contact>(),
    supabase.from("buyer_profiles").select("*").eq("contact_id", id).maybeSingle<BuyerProfile>(),
    supabase.from("interactions").select("*").eq("contact_id", id).order("occurred_at", { ascending: false }).returns<Interaction[]>(),
  ]);
  if (!contact) notFound();

  const isSeller = contact.roles.includes("vendeur");
  const isBuyer = contact.roles.includes("acquereur");
  const timeline: TimelineItem[] = (interactions ?? []).map((i) => ({ type: "interaction", date: i.occurred_at, interaction: i }));
  const address = [contact.address, [contact.postal_code, contact.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");

  return (
    <>
      <PageHeader
        title={fullName(contact)}
        description={<RoleBadges contact={contact} />}
        backHref="/contacts"
        actions={
          <>
            <Button asChild variant="outline" size="icon" aria-label="Modifier">
              <Link href={`/contacts/${contact.id}/modifier`}>
                <PencilIcon />
              </Link>
            </Button>
            <ConfirmButton
              action={deleteContact.bind(null, contact.id)}
              title="Supprimer ce contact ?"
              description="Ses échanges et sa recherche seront aussi supprimés. Cette action est définitive."
            >
              <Button variant="outline" size="icon" aria-label="Supprimer">
                <Trash2Icon />
              </Button>
            </ConfirmButton>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div className="grid content-start gap-4">
          <ContactActions phone={contact.phone} email={contact.email} />

          {(isSeller || isBuyer) && (
            <Card>
              <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                {isSeller && contact.seller_stage && <StageSelect contactId={contact.id} pipeline="vendeur" value={contact.seller_stage} />}
                {isBuyer && contact.buyer_stage && <StageSelect contactId={contact.id} pipeline="acquereur" value={contact.buyer_stage} />}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Coordonnées</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              {contact.phone && (
                <p className="flex items-center gap-1">
                  <PhoneIcon className="size-4 shrink-0 text-muted-foreground" />
                  {formatPhone(contact.phone)}
                </p>
              )}
              {contact.email && (
                <p className="flex items-center gap-1 break-all">
                  <MailIcon className="size-4 shrink-0 text-muted-foreground" />
                  {contact.email}
                </p>
              )}
              {address && (
                <p className="flex items-start gap-1">
                  <MapPinIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  {address}
                </p>
              )}
              <p className="text-muted-foreground">Source : {contact.source ? CONTACT_SOURCES[contact.source] : "non renseignée"}</p>
              {contact.notes && <p className="mt-2 rounded-md bg-muted p-3 whitespace-pre-line">{contact.notes}</p>}
            </CardContent>
          </Card>

          {isBuyer && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <SearchIcon className="size-4" /> Projet d&apos;achat
                </CardTitle>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/contacts/${contact.id}/acquereur`}>{buyer ? "Modifier" : "Renseigner"}</Link>
                </Button>
              </CardHeader>
              <CardContent>
                {buyer ? (
                  <BuyerSummary profile={buyer} />
                ) : (
                  <p className="text-sm text-muted-foreground">Qualification et critères de recherche non renseignés.</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="content-start">
          <CardHeader>
            <CardTitle>Échanges</CardTitle>
            <InteractionDialog contactId={contact.id} />
          </CardHeader>
          <CardContent className="pl-8">
            <Timeline contactId={contact.id} items={timeline} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
