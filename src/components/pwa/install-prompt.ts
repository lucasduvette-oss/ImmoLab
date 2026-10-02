/**
 * Mémorise la proposition d'installation envoyée par Chrome / Edge (événement « beforeinstallprompt »).
 *
 * Le navigateur n'envoie cet événement qu'une fois par chargement de page, souvent avant
 * l'ouverture de l'écran qui affiche le bouton « Installer » : on l'écoute donc dès le
 * démarrage (voir RegisterServiceWorker) et on le garde ici. Safari (iPhone) ne l'envoie jamais.
 */

/** Événement non standard de Chrome / Edge (absent des types TypeScript du DOM). */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installed = false;
let listening = false;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

/** Commence l'écoute (appelée une seule fois, au démarrage de l'application). */
export function listenForInstallPrompt() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("beforeinstallprompt", (event) => {
    // On ne bloque pas le bandeau du navigateur : on garde seulement l'événement pour notre bouton.
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    installed = true;
    notify();
  });
}

export function subscribeInstallPrompt(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getInstallPrompt() {
  return deferredPrompt;
}

export function wasJustInstalled() {
  return installed;
}

/** Ouvre la fenêtre d'installation du navigateur. Renvoie true si l'agent a accepté. */
export async function promptInstall() {
  const event = deferredPrompt;
  if (!event) return false;
  // Une proposition ne peut servir qu'une fois.
  deferredPrompt = null;
  notify();
  await event.prompt();
  const { outcome } = await event.userChoice;
  return outcome === "accepted";
}
