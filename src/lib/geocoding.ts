/**
 * Géocodage des adresses (adresse → coordonnées GPS) via le service officiel de l'IGN (Géoplateforme),
 * qui a remplacé l'API Adresse (api-adresse.data.gouv.fr) arrêtée fin janvier 2026.
 * Documentation : https://geoservices.ign.fr/documentation/services/services-geoplateforme/geocodage
 *
 * Le service est gratuit et sans clé. Il est appelé uniquement depuis le serveur de l'application.
 */

export type GeocodedAddress = {
  label: string; // « 12 Rue Crébillon 44000 Nantes »
  street: string; // « 12 Rue Crébillon »
  postalCode: string;
  city: string;
  citycode: string; // code INSEE
  latitude: number;
  longitude: number;
  score: number; // pertinence de 0 à 1
};

/** Adresse du service (modifiable pour les tests via la variable GEOCODING_API_URL). */
function baseUrl() {
  return process.env.GEOCODING_API_URL ?? "https://data.geopf.fr/geocodage";
}

/** Convertit la réponse GeoJSON du service en liste d'adresses (fonction pure, testée). */
export function parseGeocodingResponse(json: unknown): GeocodedAddress[] {
  const features = (json as { features?: unknown[] })?.features;
  if (!Array.isArray(features)) return [];
  return features.flatMap((f) => {
    const feature = f as {
      geometry?: { coordinates?: [number, number] };
      properties?: Record<string, unknown>;
    };
    const coords = feature.geometry?.coordinates;
    const p = feature.properties ?? {};
    if (!coords || typeof coords[0] !== "number" || typeof coords[1] !== "number") return [];
    // « name » vaut « 12 Rue Crébillon » pour une adresse, « Nantes » pour une commune seule.
    const street = p.type === "municipality" ? "" : String(p.name ?? "");
    return [
      {
        label: String(p.label ?? ""),
        street,
        postalCode: String(p.postcode ?? ""),
        city: String(p.city ?? ""),
        citycode: String(p.citycode ?? ""),
        longitude: coords[0],
        latitude: coords[1],
        score: typeof p.score === "number" ? p.score : 0,
      },
    ];
  });
}

/** Recherche d'adresses (autocomplétion). Renvoie une liste vide en cas d'erreur réseau. */
export async function searchAddresses(query: string, limit = 5): Promise<GeocodedAddress[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const url = new URL(`${baseUrl()}/search`);
  url.searchParams.set("q", q);
  url.searchParams.set("index", "address");
  url.searchParams.set("limit", String(limit));
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000), headers: { accept: "application/json" } });
    if (!res.ok) return [];
    return parseGeocodingResponse(await res.json());
  } catch {
    return [];
  }
}

/** Géocode une adresse complète et renvoie le meilleur résultat (ou null). */
export async function geocodeAddress(address: string): Promise<GeocodedAddress | null> {
  const results = await searchAddresses(address, 1);
  const best = results[0];
  return best && best.score >= 0.4 ? best : null;
}

/**
 * Géocodage inverse : commune (code INSEE et nom) de l'adresse la plus proche d'un point, ou null.
 * Utilisé pour savoir quelles communes couvre le cercle de recherche des ventes.
 * `signal` permet d'interrompre la requête (délai global de l'appelant).
 */
export async function reverseCommune(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<{ citycode: string; city: string } | null> {
  const url = new URL(`${baseUrl()}/reverse`);
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("index", "address");
  url.searchParams.set("limit", "1");
  const timeout = AbortSignal.timeout(5000);
  try {
    const res = await fetch(url, {
      signal: signal ? AbortSignal.any([timeout, signal]) : timeout,
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { features?: { properties?: { citycode?: string; city?: string } }[] };
    const props = json.features?.[0]?.properties;
    return props?.citycode ? { citycode: props.citycode, city: props.city || props.citycode } : null;
  } catch {
    return null;
  }
}
