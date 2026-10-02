import type { MetadataRoute } from "next";

/**
 * Manifeste de l'application web (PWA) : permet d'installer ImmoLab sur l'écran d'accueil
 * du téléphone et de l'ouvrir en plein écran, comme une application.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ImmoLab — assistant de l'agent immobilier",
    short_name: "ImmoLab",
    description: "Contacts, biens, relances et estimations DVF : l'assistant personnel de l'agent immobilier.",
    lang: "fr",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f8fafc",
    theme_color: "#2f4fd8",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Ma journée", url: "/", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Nouveau contact", url: "/contacts/nouveau", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Tâches", url: "/taches", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
