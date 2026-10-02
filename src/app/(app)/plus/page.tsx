import type { Metadata } from "next";
import Link from "next/link";
import { BellIcon, CalculatorIcon, ChevronRightIcon, KanbanIcon, LogOutIcon, SettingsIcon } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { InstallAppCard } from "@/components/pwa/install-app-card";
import { requireUser } from "@/lib/supabase/server";
import { countNewMatches } from "@/lib/queries/matches";
import { signOut } from "@/app/(auth)/actions";

export const metadata: Metadata = { title: "Plus" };

/** Menu « Plus » de la barre basse sur téléphone. */
export default async function MorePage() {
  const { supabase } = await requireUser();
  const newMatches = await countNewMatches(supabase);

  const links = [
    { href: "/correspondances", label: "Correspondances", icon: BellIcon, badge: newMatches },
    { href: "/contacts/pipeline", label: "Pipelines vendeurs / acquéreurs", icon: KanbanIcon },
    { href: "/estimations", label: "Estimations", icon: CalculatorIcon },
    { href: "/reglages", label: "Réglages", icon: SettingsIcon },
  ];

  return (
    <>
      <PageHeader title="Plus" />
      <ul className="divide-y overflow-hidden rounded-xl border bg-card">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="flex items-center gap-3 px-4 py-4 hover:bg-accent">
              <l.icon className="size-5 text-muted-foreground" />
              <span className="flex-1 font-medium">{l.label}</span>
              {!!l.badge && (
                <span className="rounded-full bg-destructive px-2 text-xs leading-5 font-semibold text-white">{l.badge}</span>
              )}
              <ChevronRightIcon className="size-4 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
      <InstallAppCard className="mt-6" />
      <form action={signOut} className="mt-6">
        <button
          type="submit"
          className="flex w-full items-center gap-3 rounded-xl border bg-card px-4 py-4 text-left font-medium text-destructive hover:bg-accent"
        >
          <LogOutIcon className="size-5" />
          Se déconnecter
        </button>
      </form>
    </>
  );
}
