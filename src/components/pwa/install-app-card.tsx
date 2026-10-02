"use client";

import { useSyncExternalStore } from "react";
import { DownloadIcon, ShareIcon, SmartphoneIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getInstallPrompt, promptInstall, subscribeInstallPrompt, wasJustInstalled } from "./install-prompt";

type Platform = "installed" | "ios" | "android" | "desktop";

const STANDALONE_QUERY = "(display-mode: standalone)";

/** Reconnaît l'appareil pour afficher la bonne marche à suivre. */
function detectPlatform(): Platform {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (window.matchMedia(STANDALONE_QUERY).matches || iosStandalone || wasJustInstalled()) return "installed";
  const ua = navigator.userAgent;
  // Les iPad récents se présentent comme un Mac : on les reconnaît à l'écran tactile.
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

function subscribe(callback: () => void) {
  const query = window.matchMedia(STANDALONE_QUERY);
  query.addEventListener("change", callback);
  const unsubscribe = subscribeInstallPrompt(callback);
  return () => {
    query.removeEventListener("change", callback);
    unsubscribe();
  };
}

/**
 * Carte « Installer l'application » : bouton d'installation quand le navigateur le permet
 * (Chrome, Edge), sinon la marche à suivre (Safari sur iPhone). Masquée dans l'application installée.
 */
export function InstallAppCard({ className }: { className?: string }) {
  // Côté serveur, l'appareil est inconnu : rien n'est affiché avant le chargement dans le navigateur.
  const platform = useSyncExternalStore(subscribe, detectPlatform, () => null);
  const canPrompt = useSyncExternalStore(subscribe, () => getInstallPrompt() !== null, () => false);

  if (platform === null || platform === "installed") return null;

  async function install() {
    const accepted = await promptInstall();
    if (accepted) toast.success("ImmoLab est installée : retrouvez-la sur votre écran d'accueil.");
  }

  return (
    <Card className={className}>
      <CardHeader className="flex-col">
        <CardTitle className="flex items-center gap-2">
          <SmartphoneIcon className="size-5 text-primary" />
          Installer l&apos;application
        </CardTitle>
        <CardDescription>
          Ouvrez ImmoLab depuis l&apos;écran d&apos;accueil, en plein écran, comme une application. Vos données restent
          les mêmes sur le téléphone et l&apos;ordinateur.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm">
        {canPrompt ? (
          <Button onClick={install}>
            <DownloadIcon />
            Installer ImmoLab
          </Button>
        ) : platform === "ios" ? (
          <ol className="list-decimal space-y-1 pl-5">
            <li>Ouvrez cette page dans Safari.</li>
            <li>
              Touchez le bouton Partager <ShareIcon className="inline size-4 align-text-bottom" aria-label="Partager" />{" "}
              (en bas ou en haut de l&apos;écran).
            </li>
            <li>
              Choisissez «&nbsp;Sur l&apos;écran d&apos;accueil&nbsp;», puis «&nbsp;Ajouter&nbsp;».
            </li>
          </ol>
        ) : platform === "android" ? (
          <ol className="list-decimal space-y-1 pl-5">
            <li>Ouvrez le menu ⋮ de Chrome (en haut à droite).</li>
            <li>Choisissez «&nbsp;Installer l&apos;application&nbsp;» ou «&nbsp;Ajouter à l&apos;écran d&apos;accueil&nbsp;».</li>
          </ol>
        ) : (
          <p className="text-muted-foreground">
            Dans Chrome ou Edge : cliquez sur l&apos;icône d&apos;installation à droite de la barre d&apos;adresse (ou menu ⋮
            → «&nbsp;Installer ImmoLab&nbsp;»). Dans Safari sur Mac : menu Fichier → «&nbsp;Ajouter au Dock&nbsp;».
          </p>
        )}
      </CardContent>
    </Card>
  );
}
