"use client";

import dynamic from "next/dynamic";

/**
 * Carte des comparables chargée uniquement dans le navigateur (Leaflet n'a pas de rendu serveur).
 * À utiliser à la place de comparables-map.tsx dans les pages et composants.
 */
export const ComparablesMapLazy = dynamic(() => import("./comparables-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-72 items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground sm:h-96">Chargement de la carte…</div>
  ),
});
