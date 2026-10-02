/*
 * Service worker d'ImmoLab (application installable).
 *
 * Règles volontairement prudentes, car l'application contient des données personnelles :
 *  - les pages et les données (contacts, biens…) ne sont JAMAIS mises en cache : elles viennent
 *    toujours du serveur, ce qui garantit des informations à jour sur tous les appareils ;
 *  - seuls les fichiers techniques versionnés (/_next/static/…) et les icônes sont mis en cache,
 *    pour un démarrage plus rapide ;
 *  - sans connexion, une page « Vous êtes hors connexion » s'affiche à la place d'une erreur.
 */

const VERSION = "immolab-v1";
const STATIC_CACHE = `${VERSION}-static`;
const OFFLINE_URL = "/hors-ligne";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png", "/icons/icon-512.png"];
// Les fichiers techniques changent de nom à chaque mise à jour de l'application : on limite leur nombre
// pour que les anciennes versions ne s'accumulent pas sur le téléphone.
const MAX_STATIC_ENTRIES = 250;

/** Supprime les entrées les plus anciennes au-delà de la limite (les pages précachées sont gardées). */
async function trimCache(cache) {
  const keys = await cache.keys();
  const removable = keys.filter((request) => !PRECACHE.includes(new URL(request.url).pathname));
  const excess = removable.length - MAX_STATIC_ENTRIES;
  for (let i = 0; i < excess; i++) await cache.delete(removable[i]);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  // Supprime les caches des versions précédentes.
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigation (ouverture d'une page) : toujours le réseau ; page hors connexion en secours.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  // Fichiers techniques versionnés et icônes : cache d'abord (ils ne changent jamais pour une même adresse).
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy).then(() => trimCache(cache)));
            }
            return response;
          }),
      ),
    );
  }
  // Tout le reste (données, API, photos) : comportement normal du navigateur, sans cache du service worker.
});
