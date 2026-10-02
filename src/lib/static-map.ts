import "server-only";

/**
 * Carte « statique » pour le rapport PDF, composée à partir des tuiles OpenStreetMap.
 * Les tuiles (images de 256 × 256 px) sont téléchargées côté serveur puis placées côte à côte
 * dans le PDF ; les points (bien estimé, ventes) sont dessinés par-dessus.
 *
 * Règles d'usage des tuiles OSM (https://operations.osmfoundation.org/policies/tiles/) :
 * application identifiée (User-Agent), attribution « © Contributeurs OpenStreetMap » avec l'adresse
 * openstreetmap.org/copyright sur les documents imprimables, usage modéré (une vingtaine de tuiles
 * par rapport) et mise en cache d'au moins 7 jours.
 */

const TILE_SIZE = 256;
const MAX_ZOOM = 18;
const MIN_ZOOM = 3;

export type MapPoint = { latitude: number; longitude: number; kind: "subject" | "comparable" | "excluded" };

export type StaticMap = {
  widthPx: number;
  heightPx: number;
  zoom: number;
  radiusPx: number;
  center: { x: number; y: number }; // position du bien estimé sur l'image (px)
  tiles: { left: number; top: number; dataUri: string }[]; // position de chaque tuile sur l'image (px)
  points: { x: number; y: number; kind: MapPoint["kind"] }[];
  complete: boolean; // false si certaines tuiles n'ont pas pu être téléchargées
};

/** Projection « Web Mercator » : latitude/longitude → pixels du monde au niveau de zoom z. */
export function project(latitude: number, longitude: number, zoom: number) {
  const worldSize = TILE_SIZE * 2 ** zoom;
  const latRad = (latitude * Math.PI) / 180;
  return {
    x: ((longitude + 180) / 360) * worldSize,
    y: ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * worldSize,
  };
}

/** Mètres par pixel à une latitude et un zoom donnés. */
export function metersPerPixel(latitude: number, zoom: number) {
  return (156543.03392 * Math.cos((latitude * Math.PI) / 180)) / 2 ** zoom;
}

/** Plus grand zoom pour lequel le cercle de recherche tient dans l'image (avec une marge). */
export function fitZoom(latitude: number, radiusM: number, widthPx: number, heightPx: number) {
  const available = Math.min(widthPx, heightPx) * 0.85;
  const zoom = Math.floor(Math.log2((156543.03392 * Math.cos((latitude * Math.PI) / 180) * available) / (2 * radiusM)));
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
}

/** Liste des tuiles nécessaires pour couvrir l'image centrée sur un point. */
export function tilesFor(centerX: number, centerY: number, widthPx: number, heightPx: number, zoom: number) {
  // Origine arrondie au pixel : les tuiles tombent sur des positions entières (pas de liseré).
  const x0 = Math.round(centerX - widthPx / 2);
  const y0 = Math.round(centerY - heightPx / 2);
  const max = 2 ** zoom - 1;
  const tiles: { tx: number; ty: number; left: number; top: number }[] = [];
  for (let tx = Math.floor(x0 / TILE_SIZE); tx <= Math.floor((x0 + widthPx - 1) / TILE_SIZE); tx++) {
    for (let ty = Math.floor(y0 / TILE_SIZE); ty <= Math.floor((y0 + heightPx - 1) / TILE_SIZE); ty++) {
      if (ty < 0 || ty > max) continue;
      tiles.push({ tx: ((tx % (max + 1)) + max + 1) % (max + 1), ty, left: tx * TILE_SIZE - x0, top: ty * TILE_SIZE - y0 });
    }
  }
  return { x0, y0, tiles };
}

// Petit cache en mémoire pour ne pas retélécharger les mêmes tuiles (limité à 300 tuiles).
const cache = new Map<string, string>();

/** Délai global pour charger toutes les tuiles d'une carte : au-delà, le rapport est fait avec celles reçues. */
const MAP_DEADLINE_MS = 6000;

// Au plus 2 téléchargements de tuiles en même temps pour tout le serveur (politique d'usage d'OpenStreetMap).
const MAX_PARALLEL_TILES = 2;
let activeTiles = 0;
const waitingTiles: (() => void)[] = [];

async function acquireTileSlot() {
  if (activeTiles < MAX_PARALLEL_TILES) {
    activeTiles++;
    return;
  }
  await new Promise<void>((resolve) => waitingTiles.push(resolve));
}

function releaseTileSlot() {
  const next = waitingTiles.shift();
  if (next) next(); // la place passe directement au suivant
  else activeTiles--;
}

/** Type d'image d'après les premiers octets (une page d'erreur ou un autre format n'est pas une tuile). */
function tileMime(bytes: Buffer) {
  if (bytes.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  return null;
}

async function fetchTile(z: number, x: number, y: number, deadline: AbortSignal): Promise<string | null> {
  const template = process.env.OSM_TILE_URL ?? "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
  const url = template.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y));
  const cached = cache.get(url);
  if (cached) return cached;
  await acquireTileSlot();
  try {
    if (deadline.aborted) return null;
    const res = await fetch(url, {
      // Application identifiée, comme l'exige la politique d'usage des tuiles OSM.
      headers: { "User-Agent": "ImmoLab/1.0 (assistant agent immobilier; +https://github.com/lucasduvette-oss/ImmoLab)" },
      signal: deadline,
      // Cache de 7 jours (minimum demandé par OSM), partagé entre les instances du serveur.
      next: { revalidate: 7 * 24 * 3600 },
    });
    if (!res.ok) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    const mime = tileMime(bytes);
    if (!mime) return null;
    const dataUri = `data:${mime};base64,${bytes.toString("base64")}`;
    if (cache.size > 300) cache.delete(cache.keys().next().value as string);
    cache.set(url, dataUri);
    return dataUri;
  } catch {
    return null;
  } finally {
    releaseTileSlot();
  }
}

/** Construit la carte : tuiles téléchargées (2 à la fois au plus) et position des points. */
export async function buildStaticMap(opts: {
  center: { latitude: number; longitude: number };
  radiusM: number;
  points: MapPoint[];
  widthPx?: number;
  heightPx?: number;
}): Promise<StaticMap> {
  const widthPx = opts.widthPx ?? 700;
  const heightPx = opts.heightPx ?? 400;
  const zoom = fitZoom(opts.center.latitude, opts.radiusM, widthPx, heightPx);
  const c = project(opts.center.latitude, opts.center.longitude, zoom);
  const { x0, y0, tiles } = tilesFor(c.x, c.y, widthPx, heightPx, zoom);

  const loaded: StaticMap["tiles"] = [];
  const deadline = AbortSignal.timeout(MAP_DEADLINE_MS);
  for (let i = 0; i < tiles.length && !deadline.aborted; i += MAX_PARALLEL_TILES) {
    const batch = tiles.slice(i, i + MAX_PARALLEL_TILES);
    const uris = await Promise.all(batch.map((t) => fetchTile(zoom, t.tx, t.ty, deadline)));
    batch.forEach((t, k) => {
      if (uris[k]) loaded.push({ left: t.left, top: t.top, dataUri: uris[k]! });
    });
  }

  const points = opts.points
    .map((p) => {
      const pp = project(p.latitude, p.longitude, zoom);
      return { x: pp.x - x0, y: pp.y - y0, kind: p.kind };
    })
    .filter((p) => p.x >= 0 && p.y >= 0 && p.x <= widthPx && p.y <= heightPx);

  return {
    widthPx,
    heightPx,
    zoom,
    radiusPx: opts.radiusM / metersPerPixel(opts.center.latitude, zoom),
    center: { x: c.x - x0, y: c.y - y0 },
    tiles: loaded,
    points,
    complete: loaded.length === tiles.length,
  };
}
