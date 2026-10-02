"use client"; // Les écrans d'erreur sont des composants « client » (obligatoire dans Next.js).

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangleIcon, RefreshCwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Écran affiché quand une page de l'espace connecté rencontre une erreur inattendue
 * (connexion perdue, service momentanément indisponible…). Le menu reste accessible.
 */
export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-warning/20 text-amber-700">
        <AlertTriangleIcon className="size-6" />
      </span>
      <h1 className="text-lg font-bold">Un problème est survenu</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        La page n&apos;a pas pu s&apos;afficher. Vérifiez votre connexion Internet, puis réessayez.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={() => retry()}>
          <RefreshCwIcon />
          Réessayer
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Retour à Ma journée</Link>
        </Button>
      </div>
    </div>
  );
}
