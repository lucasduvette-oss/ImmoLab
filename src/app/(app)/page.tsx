import type { Metadata } from "next";
import Link from "next/link";
import { BellIcon, CalendarIcon, CheckSquareIcon, DoorOpenIcon, MapPinIcon, SparklesIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { ContactActions } from "@/components/contact-actions";
import { MatchList } from "@/components/match-list";
import { SuggestionList } from "@/components/tasks/suggestion-list";
import { TaskDialog } from "@/components/tasks/task-dialog";
import { TaskList } from "@/components/tasks/task-list";
import { formatLongDate, formatTime, fullName, parisDayRange, todayISO } from "@/lib/format";
import { propertyAddress, propertyTitle } from "@/lib/property";
import { getLinkOptions } from "@/lib/queries/link-options";
import { listMatches } from "@/lib/queries/matches";
import { listOpenTasks, splitTasks } from "@/lib/queries/tasks";
import { getSuggestions } from "@/lib/suggestions";
import { requireUser } from "@/lib/supabase/server";
import type { Contact, Property } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Ma journée" };

type AgendaItem = {
  id: string;
  at: string;
  kind: "rdv" | "visite";
  title: React.ReactNode;
  detail: string | null;
  phone: string | null;
};

type ContactLite = Pick<Contact, "id" | "first_name" | "last_name" | "phone">;

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Écran d'accueil : rendez-vous et visites du jour, tâches, nouvelles correspondances, relances. */
export default async function TodayPage() {
  const { supabase, userId } = await requireUser();
  const { start, end } = parisDayRange();

  const [{ data: profile }, { data: meetings }, { data: visits }, openTasks, matches, suggestions, links] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("user_id", userId).maybeSingle(),
    supabase
      .from("interactions")
      .select("id, occurred_at, content, contact:contacts(id, first_name, last_name, phone)")
      .eq("kind", "rdv")
      .gte("occurred_at", start)
      .lt("occurred_at", end)
      .returns<{ id: string; occurred_at: string; content: string | null; contact: ContactLite | null }[]>(),
    supabase
      .from("visits")
      .select("id, visited_at, buyer:contacts(id, first_name, last_name, phone), property:properties(id, type, rooms, surface, city, address, postal_code)")
      .gte("visited_at", start)
      .lt("visited_at", end)
      .returns<
        {
          id: string;
          visited_at: string;
          buyer: ContactLite | null;
          property: Pick<Property, "id" | "type" | "rooms" | "surface" | "city" | "address" | "postal_code"> | null;
        }[]
      >(),
    listOpenTasks(supabase),
    listMatches(supabase, true),
    getSuggestions(supabase),
    getLinkOptions(supabase),
  ]);

  const agenda: AgendaItem[] = [
    ...(meetings ?? []).map((m) => ({
      id: m.id,
      at: m.occurred_at,
      kind: "rdv" as const,
      title: m.contact ? (
        <>
          Rendez-vous avec{" "}
          <Link href={`/contacts/${m.contact.id}`} className="text-primary hover:underline">
            {fullName(m.contact)}
          </Link>
        </>
      ) : (
        "Rendez-vous"
      ),
      detail: m.content,
      phone: m.contact?.phone ?? null,
    })),
    ...(visits ?? []).map((v) => ({
      id: v.id,
      at: v.visited_at,
      kind: "visite" as const,
      title: (
        <>
          Visite{" "}
          {v.property && (
            <Link href={`/biens/${v.property.id}`} className="text-primary hover:underline">
              {propertyTitle(v.property)}
            </Link>
          )}
          {v.buyer && <> avec {fullName(v.buyer)}</>}
        </>
      ),
      detail: v.property ? propertyAddress(v.property) : null,
      phone: v.buyer?.phone ?? null,
    })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  const { overdue, today } = splitTasks(openTasks);
  const firstName = profile?.full_name?.split(" ")[0];
  const now = new Date().toISOString();

  const summary = [
    { label: `${agenda.length} rendez-vous / visite${agenda.length > 1 ? "s" : ""}`, href: "#agenda", show: true },
    { label: `${overdue.length} tâche${overdue.length > 1 ? "s" : ""} en retard`, href: "#taches", show: overdue.length > 0, danger: true },
    { label: `${today.length} tâche${today.length > 1 ? "s" : ""} aujourd'hui`, href: "#taches", show: true },
    { label: `${matches.length} nouvelle${matches.length > 1 ? "s" : ""} correspondance${matches.length > 1 ? "s" : ""}`, href: "#correspondances", show: matches.length > 0 },
  ].filter((s) => s.show);

  return (
    <>
      <PageHeader
        title={firstName ? `Bonjour ${firstName}` : "Ma journée"}
        description={capitalize(formatLongDate(todayISO()))}
      />

      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        {summary.map((s) => (
          <a
            key={s.label}
            href={s.href}
            className={cn(
              "shrink-0 rounded-full border bg-card px-3 py-1.5 text-sm font-medium",
              s.danger && "border-destructive/30 bg-destructive/10 text-destructive",
            )}
          >
            {s.label}
          </a>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card id="agenda" className="scroll-mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="size-4" /> Agenda du jour
            </CardTitle>
          </CardHeader>
          <CardContent>
            {agenda.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun rendez-vous ni visite aujourd&apos;hui.</p>
            ) : (
              <ol className="divide-y">
                {agenda.map((item) => (
                  <li key={item.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <span className={cn("w-12 shrink-0 pt-0.5 text-sm font-semibold tabular-nums", item.at < now && "text-muted-foreground")}>
                      {formatTime(item.at)}
                    </span>
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
                      {item.kind === "rdv" ? <CalendarIcon className="size-3.5" /> : <DoorOpenIcon className="size-3.5" />}
                    </span>
                    {/* Sur téléphone, les boutons Appeler / SMS passent sous le texte pour lui laisser la place. */}
                    <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium break-words">
                          {item.title}
                          {item.at < now && <span className="ml-2 text-xs font-normal text-muted-foreground">(passé)</span>}
                        </p>
                        {item.detail && (
                          <p className="flex items-start gap-1 text-sm break-words text-muted-foreground">
                            {item.kind === "visite" && <MapPinIcon className="mt-0.5 size-3.5 shrink-0" />}
                            {item.detail}
                          </p>
                        )}
                      </div>
                      <ContactActions phone={item.phone} compact />
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card id="taches" className="scroll-mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckSquareIcon className="size-4" /> Tâches
            </CardTitle>
            <TaskDialog contacts={links.contacts} properties={links.properties} />
          </CardHeader>
          <CardContent className="grid gap-4">
            {overdue.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-destructive">En retard ({overdue.length})</h3>
                <TaskList tasks={overdue} contacts={links.contacts} properties={links.properties} />
              </div>
            )}
            <div>
              <h3 className="mb-2 text-sm font-semibold">Aujourd&apos;hui ({today.length})</h3>
              {today.length ? (
                <TaskList tasks={today} contacts={links.contacts} properties={links.properties} />
              ) : (
                <p className="text-sm text-muted-foreground">Rien de prévu aujourd&apos;hui.</p>
              )}
            </div>
            <Link href="/taches" className="text-sm text-primary hover:underline">
              Toutes les tâches →
            </Link>
          </CardContent>
        </Card>

        <Card className={cn(matches.length === 0 && "lg:col-span-2")}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SparklesIcon className="size-4" /> Relances suggérées ({suggestions.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {suggestions.length ? (
              <SuggestionList suggestions={suggestions} />
            ) : (
              <p className="text-sm text-muted-foreground">Aucune relance à faire : tout est à jour.</p>
            )}
          </CardContent>
        </Card>
        {matches.length > 0 && (
          <Card id="correspondances" className="scroll-mt-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BellIcon className="size-4" /> Nouvelles correspondances ({matches.length})
              </CardTitle>
              <Button asChild size="sm" variant="ghost">
                <Link href="/correspondances">Tout voir</Link>
              </Button>
            </CardHeader>
            <CardContent>
              <MatchList matches={matches.slice(0, 3)} show="both" />
            </CardContent>
          </Card>
        )}

      </div>
    </>
  );
}
