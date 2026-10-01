import type { Metadata } from "next";
import Link from "next/link";
import { KanbanIcon, PlusIcon, UsersIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/page-header";
import { RoleBadges } from "@/components/contact-badges";
import { ContactActions } from "@/components/contact-actions";
import { fullName } from "@/lib/format";
import { listContacts } from "@/lib/queries/contacts";
import { requireUser } from "@/lib/supabase/server";
import { ContactFilters } from "./contact-filters";

export const metadata: Metadata = { title: "Contacts" };

export default async function ContactsPage({ searchParams }: PageProps<"/contacts">) {
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const filters = { q: one(params.q), role: one(params.role), source: one(params.source), stage: one(params.stage) };

  const { supabase } = await requireUser();
  const contacts = await listContacts(supabase, filters);
  const filtered = Object.values(filters).some(Boolean);

  return (
    <>
      <PageHeader
        title="Contacts"
        description={`${contacts.length} contact${contacts.length > 1 ? "s" : ""}`}
        actions={
          <>
            <Button asChild variant="outline" size="icon" className="md:hidden" aria-label="Pipelines">
              <Link href="/contacts/pipeline">
                <KanbanIcon />
              </Link>
            </Button>
            <Button asChild>
              <Link href="/contacts/nouveau">
                <PlusIcon />
                Nouveau
              </Link>
            </Button>
          </>
        }
      />

      <ContactFilters />

      {contacts.length === 0 ? (
        <EmptyState icon={UsersIcon} title={filtered ? "Aucun contact ne correspond à la recherche" : "Aucun contact pour l'instant"}>
          {!filtered && "Ajoutez votre premier contact avec le bouton « Nouveau »."}
        </EmptyState>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {contacts.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-4 py-3">
              <Link href={`/contacts/${c.id}`} className="min-w-0 flex-1">
                <p className="truncate font-medium">{fullName(c)}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <RoleBadges contact={c} />
                  {c.city && <span className="truncate">{c.city}</span>}
                </div>
              </Link>
              <ContactActions phone={c.phone} compact />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
