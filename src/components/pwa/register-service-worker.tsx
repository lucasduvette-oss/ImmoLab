"use client";

import { useEffect } from "react";

import { listenForInstallPrompt } from "./install-prompt";

/**
 * Enregistre le service worker (public/sw.js) qui rend l'application installable et gère l'absence de réseau,
 * et commence à écouter la proposition d'installation du navigateur (bouton « Installer l'application »).
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    listenForInstallPrompt();
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Sans service worker, l'application fonctionne normalement (seulement sans page hors connexion).
    });
  }, []);
  return null;
}
