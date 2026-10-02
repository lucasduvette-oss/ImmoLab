import type { Metadata } from "next";
import Link from "next/link";
import { CalculatorIcon, PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/page-header";
import { EstimationList } from "@/components/estimation/estimation-list";
import { listEstimations } from "@/lib/queries/estimations";
import { requireUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Estimations" };

/** Historique de toutes les estimations de l'agent. */
export default async function EstimationsPage() {
  const { supabase } = await requireUser();
  const estimations = await listEstimations(supabase);

  return (
    <>
      <PageHeader
        title="Estimations"
        description="Basées sur les ventes réelles (DVF)"
        actions={
          <Button asChild>
            <Link href="/estimations/nouvelle">
              <PlusIcon />
              Nouvelle
            </Link>
          </Button>
        }
      />
      {estimations.length === 0 ? (
        <EmptyState icon={CalculatorIcon} title="Aucune estimation pour l'instant">
          Lancez une estimation depuis la fiche d&apos;un bien ou avec le bouton « Nouvelle ».
        </EmptyState>
      ) : (
        <Card>
          <CardContent>
            <EstimationList estimations={estimations} />
          </CardContent>
        </Card>
      )}
    </>
  );
}
