import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BuildingIcon, MapPinIcon, PencilIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmButton } from "@/components/confirm-button";
import { PageHeader } from "@/components/page-header";
import { ComparablesMapLazy } from "@/components/estimation/comparables-map-lazy";
import { ADJUSTMENT_LABELS, type Adjustments } from "@/lib/estimation";
import { formatDate, formatEuros, formatEurosPerSqm, formatNumber, formatPercent, formatSurface } from "@/lib/format";
import { propertyAddress } from "@/lib/property";
import { getEstimation } from "@/lib/queries/estimations";
import { requireUser } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { deleteEstimation } from "../actions";

export const metadata: Metadata = { title: "Estimation" };

function Tile({ label, value, strong, className }: { label: string; value: string; strong?: boolean; className?: string }) {
  return (
    <div className={cn("rounded-lg bg-muted/60 px-3 py-2", className)}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("font-semibold", strong && "text-xl font-bold")}>{value}</dd>
    </div>
  );
}

/** Détail d'une estimation enregistrée : résultat, ajustements, comparables, argumentaire. */
export default async function EstimationPage({ params }: PageProps<"/estimations/[id]">) {
  const { id } = await params;
  const { supabase } = await requireUser();
  const e = await getEstimation(supabase, id);
  if (!e) notFound();

  const kept = e.comparables.filter((c) => !c.excluded).sort((a, b) => a.distance - b.distance);
  const excludedCount = e.comparables.length - kept.length;
  const adjustments = Object.entries(e.adjustments ?? {}).filter(([, v]) => Number(v) !== 0) as [keyof Adjustments, number][];
  const totalAdj = adjustments.reduce((s, [, v]) => s + Number(v), 0);

  return (
    <>
      <PageHeader
        title={`Estimation · ${e.property_type === "maison" ? "Maison" : "Appartement"} ${formatSurface(e.surface)}`}
        description={
          <span className="flex items-center gap-1">
            <MapPinIcon className="size-3.5" />
            {propertyAddress(e) || "Adresse non renseignée"} · le {formatDate(e.created_at)}
          </span>
        }
        backHref={e.property_id ? `/biens/${e.property_id}` : "/estimations"}
        actions={
          <>
            <Button asChild variant="outline" size="icon" aria-label="Modifier">
              <Link href={`/estimations/${e.id}/modifier`}>
                <PencilIcon />
              </Link>
            </Button>
            <ConfirmButton action={deleteEstimation.bind(null, e.id)} title="Supprimer cette estimation ?" description="Cette action est définitive.">
              <Button variant="outline" size="icon" aria-label="Supprimer">
                <Trash2Icon />
              </Button>
            </ConfirmButton>
          </>
        }
      />

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Résultat</CardTitle>
            {e.property_id && (
              <Button asChild size="sm" variant="ghost">
                <Link href={`/biens/${e.property_id}`}>
                  <BuildingIcon /> Fiche du bien
                </Link>
              </Button>
            )}
          </CardHeader>
          <CardContent className="grid gap-3">
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Tile label="Prix médian au m²" value={formatEurosPerSqm(e.median_price_sqm)} />
              <Tile label="Fourchette basse" value={formatEuros(e.low_value)} />
              <Tile label="Fourchette moyenne" value={formatEuros(e.mid_value)} className="bg-accent" />
              <Tile label="Fourchette haute" value={formatEuros(e.high_value)} />
            </dl>
            <dl className="grid gap-2 sm:grid-cols-3">
              <Tile
                label={`Prix de mise en vente${e.fees_charged_to === "acquereur" ? " (honoraires inclus)" : ""}`}
                value={formatEuros(e.recommended_price)}
                strong
                className="border-2 border-primary bg-card"
              />
              <Tile
                label={`Honoraires (${e.fees_mode === "pourcentage" ? `${formatNumber(e.fees_value)} %` : "montant"}, charge ${e.fees_charged_to === "vendeur" ? "vendeur" : "acquéreur"})`}
                value={formatEuros(e.fees_amount)}
              />
              <Tile label="Prix net vendeur" value={formatEuros(e.net_seller_price)} strong className="bg-success/10" />
            </dl>
            <p className="text-xs text-muted-foreground">
              {e.comparables_count} vente{e.comparables_count > 1 ? "s" : ""} retenue{e.comparables_count > 1 ? "s" : ""}
              {excludedCount > 0 && ` (${excludedCount} exclue${excludedCount > 1 ? "s" : ""})`} dans un rayon de {formatNumber(e.radius_m)} m, sur{" "}
              {e.period_years} an{e.period_years > 1 ? "s" : ""}, surface ±{e.surface_tolerance_pct} %.
              {adjustments.length > 0 && (
                <>
                  {" "}
                  Ajustements : {adjustments.map(([k, v]) => `${ADJUSTMENT_LABELS[k]} ${formatPercent(Number(v))}`).join(", ")} (total{" "}
                  {formatPercent(totalAdj)}).
                </>
              )}{" "}
              Source : {e.data_source ?? "DVF"}.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ventes comparables retenues</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <ComparablesMapLazy center={{ latitude: e.latitude, longitude: e.longitude }} radiusM={e.radius_m} comparables={e.comparables} />
            <div className="-mx-4 overflow-x-auto md:mx-0">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="px-2 py-2 font-medium">Date</th>
                    <th className="px-2 py-2 text-right font-medium">Surface</th>
                    <th className="px-2 py-2 text-right font-medium">Pièces</th>
                    <th className="px-2 py-2 text-right font-medium">Prix</th>
                    <th className="px-2 py-2 text-right font-medium">Prix/m²</th>
                    <th className="px-2 py-2 text-right font-medium">Distance</th>
                  </tr>
                </thead>
                <tbody>
                  {kept.map((c) => (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="px-2 py-2 whitespace-nowrap">{formatDate(c.date)}</td>
                      <td className="px-2 py-2 text-right whitespace-nowrap">{formatSurface(c.surface)}</td>
                      <td className="px-2 py-2 text-right">{c.rooms ?? "—"}</td>
                      <td className="px-2 py-2 text-right whitespace-nowrap">{formatEuros(c.price)}</td>
                      <td className="px-2 py-2 text-right font-medium whitespace-nowrap">{formatEurosPerSqm(c.pricePerSqm)}</td>
                      <td className="px-2 py-2 text-right whitespace-nowrap">{formatNumber(Math.round(c.distance))} m</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {e.arguments && (
          <Card>
            <CardHeader>
              <CardTitle>Argumentaire</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-line">{e.arguments}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
