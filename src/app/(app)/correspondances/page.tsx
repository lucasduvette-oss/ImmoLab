import type { Metadata } from "next";
import { BellIcon, CheckCheckIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { ActionButton } from "@/components/action-button";
import { EmptyState, PageHeader } from "@/components/page-header";
import { MatchList } from "@/components/match-list";
import { listMatches } from "@/lib/queries/matches";
import { requireUser } from "@/lib/supabase/server";
import { markMatchesSeen } from "./actions";

export const metadata: Metadata = { title: "Correspondances" };

/** Toutes les correspondances biens / acquéreurs, les nouvelles en premier. */
export default async function MatchesPage() {
  const { supabase } = await requireUser();
  const matches = await listMatches(supabase);
  const newCount = matches.filter((m) => !m.seen_at).length;

  return (
    <>
      <PageHeader
        title="Correspondances"
        description={newCount ? `${newCount} nouvelle${newCount > 1 ? "s" : ""}` : "Aucune nouvelle correspondance"}
        actions={
          newCount > 0 && (
            <ActionButton variant="outline" action={markMatchesSeen.bind(null, undefined)} success="Correspondances marquées comme vues.">
              <CheckCheckIcon />
              Tout marquer comme vu
            </ActionButton>
          )
        }
      />
      <p className="mb-4 text-sm text-muted-foreground">
        Calculées automatiquement à chaque modification d&apos;un bien (en estimation ou en vente) ou d&apos;une recherche
        d&apos;acquéreur. Le score tient compte du budget, de la surface, du nombre de pièces et des critères indispensables.
      </p>
      {matches.length === 0 ? (
        <EmptyState icon={BellIcon} title="Aucune correspondance pour l'instant">
          Renseignez les critères de recherche de vos acquéreurs et les caractéristiques de vos biens.
        </EmptyState>
      ) : (
        <Card>
          <CardContent>
            <MatchList matches={matches} show="both" />
          </CardContent>
        </Card>
      )}
    </>
  );
}
