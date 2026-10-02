import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangleIcon, CalculatorIcon, MapPinIcon, PencilIcon, PlusIcon, SendIcon, Trash2Icon, UsersIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { ConfirmButton } from "@/components/confirm-button";
import { TaskDialog } from "@/components/tasks/task-dialog";
import { TaskList } from "@/components/tasks/task-list";
import { ActionButton } from "@/components/action-button";
import { ContactActions } from "@/components/contact-actions";
import { MatchList } from "@/components/match-list";
import { EstimationList } from "@/components/estimation/estimation-list";
import { StatusBadge } from "@/components/property-badges";
import { Stars } from "@/components/stars";
import { MANDATE_TYPES, OUTDOOR_TYPES, PARKING_TYPES, PROPERTY_CONDITIONS } from "@/lib/constants";
import { formatDate, formatDateTime, formatEuros, formatNumber, formatSurface, fullName } from "@/lib/format";
import { mandateAlert, mandateAlertText, propertyAddress, propertyTitle } from "@/lib/property";
import { listContactOptions } from "@/lib/queries/contacts";
import { matchesForProperty } from "@/lib/queries/matches";
import { listEstimations } from "@/lib/queries/estimations";
import { signPhotoUrls } from "@/lib/queries/properties";
import { getLinkOptions } from "@/lib/queries/link-options";
import { tasksFor } from "@/lib/queries/tasks";
import { requireUser } from "@/lib/supabase/server";
import type { Contact, Property, PropertyPhoto, Visit } from "@/lib/types";
import { cn } from "@/lib/utils";
import { deleteProperty, deleteVisit, markFeedbackSent } from "../actions";
import { PhotoManager } from "./photo-manager";
import { PropertyStatusSelect } from "./status-select";
import { VisitDialog } from "./visit-dialog";

export async function generateMetadata({ params }: PageProps<"/biens/[id]">): Promise<Metadata> {
  const { id } = await params;
  const { supabase } = await requireUser();
  const { data } = await supabase.from("properties").select("type, rooms, surface, city").eq("id", id).maybeSingle<Property>();
  return { title: data ? propertyTitle(data) : "Bien" };
}

function Info({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-lg bg-muted/60 px-3 py-2", className)}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}

const yesNo = (v: boolean | null) => (v === null ? "—" : v ? "Oui" : "Non");

export default async function PropertyPage({ params }: PageProps<"/biens/[id]">) {
  const { id } = await params;
  const { supabase, userId } = await requireUser();

  const [{ data: property }, { data: photos }, { data: visits }, buyers, matches, tasks, links, estimations] = await Promise.all([
    supabase.from("properties").select("*").eq("id", id).maybeSingle<Property>(),
    supabase.from("property_photos").select("*").eq("property_id", id).order("position").order("created_at").returns<PropertyPhoto[]>(),
    supabase
      .from("visits")
      .select("*, buyer:contacts(id, first_name, last_name)")
      .eq("property_id", id)
      .order("visited_at", { ascending: false })
      .returns<(Visit & { buyer: Pick<Contact, "id" | "first_name" | "last_name"> | null })[]>(),
    listContactOptions(supabase, "acquereur"),
    matchesForProperty(supabase, id),
    tasksFor(supabase, { propertyId: id }),
    getLinkOptions(supabase),
    listEstimations(supabase, id),
  ]);
  if (!property) notFound();

  const { data: seller } = property.seller_contact_id
    ? await supabase.from("contacts").select("*").eq("id", property.seller_contact_id).maybeSingle<Contact>()
    : { data: null };

  const urls = await signPhotoUrls(supabase, (photos ?? []).map((p) => p.storage_path));
  const alert = mandateAlert(property);
  const now = new Date().toISOString();

  return (
    <>
      <PageHeader
        title={propertyTitle(property)}
        description={
          <span className="flex items-center gap-1">
            <MapPinIcon className="size-3.5" />
            {propertyAddress(property) || "Adresse non renseignée"}
          </span>
        }
        backHref="/biens"
        actions={
          <>
            <Button asChild variant="outline" size="icon" aria-label="Modifier">
              <Link href={`/biens/${property.id}/modifier`}>
                <PencilIcon />
              </Link>
            </Button>
            <ConfirmButton
              action={deleteProperty.bind(null, property.id)}
              title="Supprimer ce bien ?"
              description="Ses photos et ses visites seront aussi supprimées. Cette action est définitive."
            >
              <Button variant="outline" size="icon" aria-label="Supprimer">
                <Trash2Icon />
              </Button>
            </ConfirmButton>
          </>
        }
      />

      {alert && (
        <div
          role="alert"
          className={cn(
            "mb-4 flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium",
            alert.expired ? "bg-destructive/10 text-destructive" : "bg-warning/20 text-amber-900",
          )}
        >
          <AlertTriangleIcon className="size-4 shrink-0" />
          {mandateAlertText(alert)} ({formatDate(property.mandate_end)}).
        </div>
      )}

      <div className="mb-4">
        <PhotoManager
          propertyId={property.id}
          userId={userId}
          photos={(photos ?? []).map((p) => ({ id: p.id, url: urls[p.storage_path] ?? null }))}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="grid content-start gap-4">
          <Card>
            <CardHeader>
              <div>
                <p className="text-2xl font-bold text-primary">{formatEuros(property.price)}</p>
                {property.price && property.surface ? (
                  <p className="text-sm text-muted-foreground">{formatEuros(property.price / property.surface)}/m²</p>
                ) : null}
              </div>
              <div className="w-44">
                <PropertyStatusSelect propertyId={property.id} value={property.status} />
              </div>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                <Info label="Surface">{formatSurface(property.surface)}</Info>
                <Info label="Pièces / chambres">
                  {formatNumber(property.rooms)} / {formatNumber(property.bedrooms)}
                </Info>
                <Info label="Étage">{property.floor === null ? "—" : property.floor === 0 ? "RDC" : property.floor}</Info>
                <Info label="Ascenseur">{yesNo(property.has_elevator)}</Info>
                <Info label="Extérieur">{property.outdoor ? OUTDOOR_TYPES[property.outdoor] : "—"}</Info>
                <Info label="Parking">{property.parking ? PARKING_TYPES[property.parking] : "—"}</Info>
                <Info label="Construction">{property.construction_year ?? "—"}</Info>
                <Info label="DPE / GES">
                  {property.dpe ?? "—"} / {property.ges ?? "—"}
                </Info>
                <Info label="État">{property.condition ? PROPERTY_CONDITIONS[property.condition] : "—"}</Info>
                <Info label="Charges">{property.charges_annual ? `${formatEuros(property.charges_annual)}/an` : "—"}</Info>
                <Info label="Taxe foncière">{property.property_tax ? `${formatEuros(property.property_tax)}/an` : "—"}</Info>
              </dl>
              {property.description && <p className="mt-4 text-sm whitespace-pre-line">{property.description}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UsersIcon className="size-4" /> Acquéreurs compatibles ({matches.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {matches.length ? (
                <MatchList matches={matches} show="buyer" />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {["estimation", "en_vente"].includes(property.status)
                    ? "Aucun acquéreur ne correspond pour l'instant."
                    : "Le rapprochement ne concerne que les biens en estimation ou en vente."}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Visites ({visits?.length ?? 0})</CardTitle>
              <VisitDialog propertyId={property.id} buyers={buyers} />
            </CardHeader>
            <CardContent>
              {!visits?.length ? (
                <p className="text-sm text-muted-foreground">Aucune visite pour l&apos;instant.</p>
              ) : (
                <ul className="divide-y">
                  {visits.map((v) => {
                    const past = v.visited_at <= now;
                    return (
                      <li key={v.id} className="grid gap-1 py-3 first:pt-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium">
                              {v.buyer ? (
                                <Link href={`/contacts/${v.buyer.id}`} className="hover:underline">
                                  {fullName(v.buyer)}
                                </Link>
                              ) : (
                                "Acquéreur supprimé"
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDateTime(v.visited_at)}
                              {!past && <span className="ml-2 font-semibold text-primary">À venir</span>}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            {v.rating && <Stars value={v.rating} />}
                            <VisitDialog
                              propertyId={property.id}
                              buyers={buyers}
                              visit={v}
                              trigger={
                                <Button variant="ghost" size="icon-sm" aria-label="Modifier la visite">
                                  <PencilIcon />
                                </Button>
                              }
                            />
                            <ConfirmButton action={deleteVisit.bind(null, v.id)} title="Supprimer cette visite ?">
                              <Button variant="ghost" size="icon-sm" aria-label="Supprimer la visite">
                                <Trash2Icon />
                              </Button>
                            </ConfirmButton>
                          </div>
                        </div>
                        {v.feedback && <p className="text-sm whitespace-pre-line">{v.feedback}</p>}
                        {past && (v.rating || v.feedback) && (
                          <div className="text-xs">
                            {v.feedback_sent_at ? (
                              <span className="text-success">Retour transmis au vendeur le {formatDate(v.feedback_sent_at)}</span>
                            ) : (
                              <ActionButton size="sm" variant="outline" action={markFeedbackSent.bind(null, v.id)} success="Retour marqué comme transmis.">
                                <SendIcon /> Marquer le retour comme transmis
                              </ActionButton>
                            )}
                          </div>
                        )}
                        {past && !v.rating && !v.feedback && <p className="text-xs text-amber-700">Retour de visite à recueillir.</p>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid content-start gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalculatorIcon className="size-4" /> Estimations ({estimations.length})
              </CardTitle>
              <Button asChild size="sm">
                <Link href={`/estimations/nouvelle?bien=${property.id}`}>
                  <PlusIcon /> Estimer
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {estimations.length ? (
                <EstimationList estimations={estimations} showAddress={false} />
              ) : (
                <p className="text-sm text-muted-foreground">Aucune estimation : lancez-en une à partir des ventes DVF du secteur.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Vendeur</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {seller ? (
                <>
                  <Link href={`/contacts/${seller.id}`} className="font-medium hover:underline">
                    {fullName(seller)}
                  </Link>
                  <ContactActions phone={seller.phone} email={seller.email} />
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Aucun vendeur lié.{" "}
                  <Link href={`/biens/${property.id}/modifier`} className="text-primary hover:underline">
                    Choisir un vendeur
                  </Link>
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tâches</CardTitle>
              <TaskDialog
                contacts={links.contacts}
                properties={links.properties}
                defaultProperty={{ id: property.id, label: propertyTitle(property) }}
              />
            </CardHeader>
            <CardContent>
              {tasks.length ? (
                <TaskList tasks={tasks} contacts={links.contacts} properties={links.properties} hideLink="property" />
              ) : (
                <p className="text-sm text-muted-foreground">Aucune tâche liée à ce bien.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Mandat</CardTitle>
              <StatusBadge status={property.status} />
            </CardHeader>
            <CardContent>
              {property.mandate_type ? (
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <Info label="Type">{MANDATE_TYPES[property.mandate_type]}</Info>
                  <Info label="Honoraires TTC">{formatEuros(property.mandate_fees)}</Info>
                  <Info label="Début">{formatDate(property.mandate_start)}</Info>
                  <Info label="Fin" className={cn(alert && "bg-warning/20")}>
                    {formatDate(property.mandate_end)}
                  </Info>
                </dl>
              ) : (
                <p className="text-sm text-muted-foreground">Pas de mandat renseigné.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
