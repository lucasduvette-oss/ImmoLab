import { DesktopSidebar, MobileBottomNav } from "@/components/app-nav";
import { requireUser } from "@/lib/supabase/server";
import { countNewMatches } from "@/lib/queries/matches";

/**
 * Mise en page de l'espace connecté :
 *  - sur ordinateur : menu latéral à gauche ;
 *  - sur téléphone : barre de navigation en bas de l'écran.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { supabase } = await requireUser();
  const newMatches = await countNewMatches(supabase);

  return (
    <div className="flex min-h-dvh">
      <DesktopSidebar newMatches={newMatches} />
      <main className="min-w-0 flex-1 px-4 pt-4 pb-24 md:px-8 md:pt-8 md:pb-10">
        <div className="mx-auto w-full max-w-5xl">{children}</div>
      </main>
      <MobileBottomNav newMatches={newMatches} />
    </div>
  );
}
