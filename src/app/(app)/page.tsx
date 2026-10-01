import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { formatLongDate, todayISO } from "@/lib/format";
import { requireUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Ma journée" };

/** Écran d'accueil « Ma journée » (complété à l'étape 5). */
export default async function TodayPage() {
  const { supabase, userId } = await requireUser();
  const { data: profile } = await supabase.from("profiles").select("full_name").eq("user_id", userId).maybeSingle();
  const firstName = profile?.full_name?.split(" ")[0];

  return (
    <>
      <PageHeader
        title={firstName ? `Bonjour ${firstName}` : "Ma journée"}
        description={<span className="capitalize">{formatLongDate(todayISO())}</span>}
      />
      <p className="text-muted-foreground">Votre espace est prêt.</p>
    </>
  );
}
