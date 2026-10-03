import type { Metadata } from "next";
import Link from "next/link";
import { BuildingIcon, ImageIcon, PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/page-header";
import { MandateAlertBadge, StatusBadge } from "@/components/property-badges";
import { formatEuros } from "@/lib/format";
import { propertyAddress, propertyTitle } from "@/lib/property";
import { listProperties } from "@/lib/queries/properties";
import { requireUser } from "@/lib/supabase/server";
import { PropertyFilters } from "./property-filters";

export const metadata: Metadata = { title: "Biens" };

export default async function PropertiesPage({ searchParams }: PageProps<"/biens">) {
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const filters = { q: one(params.q), status: one(params.statut), type: one(params.type), mandat: one(params.mandat) };

  const { supabase } = await requireUser();
  const properties = await listProperties(supabase, filters);
  const filtered = Object.values(filters).some(Boolean);

  return (
    <>
      <PageHeader
        title="Biens"
        description={`${properties.length} bien${properties.length > 1 ? "s" : ""}`}
        actions={
          <Button asChild>
            <Link href="/biens/nouveau">
              <PlusIcon />
              Nouveau
            </Link>
          </Button>
        }
      />
      <PropertyFilters />

      {properties.length === 0 ? (
        <EmptyState icon={BuildingIcon} title={filtered ? "Aucun bien ne correspond à la recherche" : "Aucun bien pour l'instant"}>
          {!filtered && "Ajoutez votre premier bien avec le bouton « Nouveau »."}
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((p) => (
            <li key={p.id}>
              <Link href={`/biens/${p.id}`} className="flex h-full overflow-hidden rounded-xl border bg-card shadow-xs transition hover:shadow-md sm:flex-col">
                <div className="relative w-28 shrink-0 bg-muted sm:aspect-[4/3] sm:w-full">
                  {p.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- photo privée servie par un lien temporaire Supabase
                    <img src={p.coverUrl} alt="" className="absolute inset-0 size-full object-cover" loading="lazy" />
                  ) : (
                    <ImageIcon className="absolute top-1/2 left-1/2 size-6 -translate-1/2 text-muted-foreground" />
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1 p-3">
                  <div className="flex flex-wrap gap-1">
                    <StatusBadge status={p.status} />
                    <MandateAlertBadge property={p} />
                  </div>
                  <p className="truncate font-medium">{propertyTitle(p)}</p>
                  <p className="truncate text-sm text-muted-foreground">{propertyAddress(p) || "Adresse non renseignée"}</p>
                  <p className="mt-auto font-semibold text-primary">{formatEuros(p.price)}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
