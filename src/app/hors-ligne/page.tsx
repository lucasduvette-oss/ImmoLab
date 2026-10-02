import type { Metadata } from "next";
import { RefreshCwIcon, WifiOffIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Hors connexion" };

/**
 * Page affichée par l'application installée quand il n'y a pas de réseau.
 * Elle est mise en cache par le service worker (public/sw.js) : elle ne doit contenir aucune donnée personnelle.
 */
export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <WifiOffIcon className="size-7" />
      </span>
      <h1 className="text-xl font-bold">Vous êtes hors connexion</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        ImmoLab a besoin d&apos;Internet pour afficher vos contacts, biens et tâches à jour sur tous vos appareils.
        Vérifiez votre connexion (4G ou Wi-Fi), puis réessayez.
      </p>
      {/* Lien vers l'adresse actuelle : recharge la page demandée, même sans JavaScript en cache. */}
      <a href="" className={buttonVariants()}>
        <RefreshCwIcon />
        Réessayer
      </a>
    </main>
  );
}
