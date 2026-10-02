import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // En-têtes HTTP ajoutés à toutes les réponses (recommandations du guide PWA de Next.js).
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Le navigateur ne doit pas « deviner » le type d'un fichier.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Interdit d'afficher ImmoLab dans un cadre d'un autre site (protection contre le clickjacking).
          { key: "X-Frame-Options", value: "DENY" },
          // N'envoie que le nom du site (pas l'adresse complète de la page) aux sites externes.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        // Le service worker doit toujours être relu depuis le serveur pour que les mises à jour arrivent.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
