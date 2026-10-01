import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { BUYER_STAGES, SELLER_STAGES, toOptions } from "@/lib/constants";
import { formatEuros, fullName } from "@/lib/format";
import { requireUser } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { KanbanBoard, type KanbanCard } from "./kanban-board";

export const metadata: Metadata = { title: "Pipelines" };

type Row = {
  id: string;
  first_name: string | null;
  last_name: string;
  city: string | null;
  seller_stage: string | null;
  buyer_stage: string | null;
  buyer_profiles: { budget_max: number | null }[] | { budget_max: number | null } | null;
};

/** Pipelines vendeurs et acquéreurs en vue Kanban. */
export default async function PipelinePage({ searchParams }: PageProps<"/contacts/pipeline">) {
  const { type } = await searchParams;
  const pipeline = type === "acquereurs" ? "acquereur" : "vendeur";
  const { supabase } = await requireUser();

  const { data } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, city, seller_stage, buyer_stage, buyer_profiles(budget_max)")
    .contains("roles", [pipeline])
    .order("updated_at", { ascending: false })
    .returns<Row[]>();

  const cards: KanbanCard[] = (data ?? []).map((c) => {
    const bp = Array.isArray(c.buyer_profiles) ? c.buyer_profiles[0] : c.buyer_profiles;
    return {
      id: c.id,
      name: fullName(c),
      stage: (pipeline === "vendeur" ? c.seller_stage : c.buyer_stage) ?? "",
      subtitle: pipeline === "acquereur" && bp?.budget_max ? `Budget ${formatEuros(bp.budget_max)}` : c.city,
    };
  });
  const columns = toOptions(pipeline === "vendeur" ? SELLER_STAGES : BUYER_STAGES).map((o) => ({ key: o.value, label: o.label }));

  const tabs = [
    { href: "/contacts/pipeline?type=vendeurs", label: "Vendeurs", active: pipeline === "vendeur" },
    { href: "/contacts/pipeline?type=acquereurs", label: "Acquéreurs", active: pipeline === "acquereur" },
  ];

  return (
    <>
      <PageHeader title="Pipelines" backHref="/contacts" description="Glissez une carte vers une autre colonne (appui long sur téléphone)." />
      <nav className="mb-4 inline-flex rounded-lg bg-muted p-1">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium text-muted-foreground",
              t.active && "bg-card text-foreground shadow-sm",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {/* La clé force la réinitialisation du tableau quand on change d'onglet. */}
      <KanbanBoard key={pipeline} pipeline={pipeline} columns={columns} initialCards={cards} />
    </>
  );
}
