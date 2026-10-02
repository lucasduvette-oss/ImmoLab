/**
 * Calculs de l'estimation à partir des ventes comparables (DVF).
 * Fonctions « pures » (sans accès réseau ni base) : elles sont testées dans __tests__/estimation.test.ts.
 *
 * Méthode :
 *  1. on garde les ventes comparables non exclues par l'agent ;
 *  2. on calcule le prix au m² de chacune, puis le 1er quartile, la médiane et le 3e quartile ;
 *  3. fourchette = prix au m² × surface du bien × (1 + somme des ajustements en %),
 *     basse = 1er quartile, moyenne = médiane, haute = 3e quartile ;
 *  4. prix de mise en vente conseillé = valeur moyenne arrondie au millier (modifiable par l'agent) ;
 *  5. net vendeur = prix conseillé − honoraires.
 */

export type EstimationPropertyType = "appartement" | "maison";

/** Une vente comparable, telle qu'elle est affichée et enregistrée (copie figée dans l'estimation). */
export type Comparable = {
  id: string; // identifiant de la vente (mutation DVF)
  date: string; // date de la vente AAAA-MM-JJ
  type: EstimationPropertyType;
  price: number; // valeur foncière en €
  surface: number; // surface bâtie en m²
  rooms: number | null;
  landSurface: number | null; // surface du terrain (m²), utile pour les maisons
  label: string | null; // adresse ou commune, si connue
  latitude: number;
  longitude: number;
  distance: number; // distance au bien estimé, en mètres
  pricePerSqm: number;
  excluded: boolean; // exclu par l'agent (ou pré-exclu car atypique)
  outlier: boolean; // prix au m² atypique (détecté automatiquement)
};

/** Ajustements en % saisis par l'agent (positifs ou négatifs). */
export type Adjustments = {
  dpe: number;
  etage: number;
  exterieur: number;
  etat: number;
  travaux: number;
};

export const ADJUSTMENT_LABELS: Record<keyof Adjustments, string> = {
  dpe: "DPE",
  etage: "Étage",
  exterieur: "Extérieur",
  etat: "État",
  travaux: "Travaux",
};

export const NO_ADJUSTMENTS: Adjustments = { dpe: 0, etage: 0, exterieur: 0, etat: 0, travaux: 0 };

export type Fees = {
  mode: "pourcentage" | "montant";
  value: number; // % ou €
  chargedTo: "vendeur" | "acquereur";
};

/** Paramètres de recherche par défaut. */
export const DEFAULT_SEARCH = { radiusM: 500, periodYears: 3, surfaceTolerancePct: 20 };

/** En dessous de ce nombre de comparables retenus, un avertissement est affiché. */
export const MIN_COMPARABLES = 5;

// ------------------------------------------------------------------ Géographie

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Distance « à vol d'oiseau » entre deux points GPS, en mètres (formule de haversine). */
export function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

/** Rectangle (en degrés) qui contient le cercle de rayon `radiusM` autour d'un point. */
export function boundingBox(lat: number, lon: number, radiusM: number) {
  const dLat = (radiusM / EARTH_RADIUS_M) * (180 / Math.PI);
  const dLon = dLat / Math.cos(toRad(lat));
  return { minLat: lat - dLat, maxLat: lat + dLat, minLon: lon - dLon, maxLon: lon + dLon };
}

/**
 * Découpe un rectangle en carrés d'au plus `maxSize` degrés de côté
 * (l'API DVF limite la taille de la zone interrogée en une requête).
 */
export function splitBoundingBox(box: ReturnType<typeof boundingBox>, maxSize: number) {
  const tiles: ReturnType<typeof boundingBox>[] = [];
  const nLat = Math.max(1, Math.ceil((box.maxLat - box.minLat) / maxSize - 1e-9));
  const nLon = Math.max(1, Math.ceil((box.maxLon - box.minLon) / maxSize - 1e-9));
  const stepLat = (box.maxLat - box.minLat) / nLat;
  const stepLon = (box.maxLon - box.minLon) / nLon;
  for (let i = 0; i < nLat; i++) {
    for (let j = 0; j < nLon; j++) {
      tiles.push({
        minLat: box.minLat + i * stepLat,
        maxLat: box.minLat + (i + 1) * stepLat,
        minLon: box.minLon + j * stepLon,
        maxLon: box.minLon + (j + 1) * stepLon,
      });
    }
  }
  return tiles;
}

// ---------------------------------------------------------------- Statistiques

/** Quantile d'une liste triée (interpolation linéaire, comme la fonction QUARTILE d'un tableur). */
export function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * q;
  const lower = Math.floor(pos);
  const upper = Math.ceil(pos);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (pos - lower);
}

/**
 * Repère les prix au m² atypiques (règle classique : en dehors de
 * [Q1 − 1,5 × écart interquartile ; Q3 + 1,5 × écart interquartile]).
 * Nécessite au moins 5 ventes, sinon rien n'est signalé.
 */
export function flagOutliers<T extends { pricePerSqm: number }>(items: T[]): (T & { outlier: boolean })[] {
  if (items.length < MIN_COMPARABLES) return items.map((c) => ({ ...c, outlier: false }));
  const sorted = items.map((c) => c.pricePerSqm).sort((a, b) => a - b);
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  const iqr = q3 - q1;
  const low = q1 - 1.5 * iqr;
  const high = q3 + 1.5 * iqr;
  return items.map((c) => ({ ...c, outlier: c.pricePerSqm < low || c.pricePerSqm > high }));
}

// ---------------------------------------------------------------------- Calcul

export type EstimationResult = {
  count: number; // nombre de comparables retenus
  q1PricePerSqm: number;
  medianPricePerSqm: number;
  q3PricePerSqm: number;
  adjustmentPct: number; // somme des ajustements
  low: number;
  mid: number;
  high: number;
  recommendedPrice: number;
  feesAmount: number;
  netSellerPrice: number;
  lowConfidence: boolean; // moins de MIN_COMPARABLES ventes
};

/** Arrondi au multiple le plus proche (1 000 € par défaut). */
export function roundTo(value: number, step = 1000): number {
  return Math.round(value / step) * step;
}

/** Somme des ajustements en %. */
export function totalAdjustment(adjustments: Adjustments): number {
  return Object.values(adjustments).reduce((sum, v) => sum + (Number.isFinite(v) ? v : 0), 0);
}

/**
 * Honoraires et net vendeur à partir du prix de mise en vente.
 * - honoraires à la charge du vendeur, en % : % du prix de vente ;
 * - honoraires à la charge de l'acquéreur, en % : % du net vendeur (le prix affiché inclut les honoraires) ;
 * - en montant : le montant saisi.
 * Dans tous les cas : net vendeur = prix de mise en vente − honoraires.
 */
export function computeFees(price: number, fees: Fees): { feesAmount: number; netSellerPrice: number } {
  let feesAmount = 0;
  if (fees.mode === "montant") feesAmount = fees.value;
  else if (fees.chargedTo === "vendeur") feesAmount = (price * fees.value) / 100;
  else feesAmount = price - price / (1 + fees.value / 100);
  feesAmount = Math.max(0, Math.round(feesAmount));
  return { feesAmount, netSellerPrice: Math.round(price - feesAmount) };
}

/** Calcule la fourchette, le prix conseillé et le net vendeur. Renvoie null sans comparable retenu. */
export function computeEstimation(input: {
  comparables: Pick<Comparable, "pricePerSqm" | "excluded">[];
  surface: number;
  adjustments: Adjustments;
  fees: Fees;
  recommendedOverride?: number | null;
}): EstimationResult | null {
  const kept = input.comparables.filter((c) => !c.excluded && Number.isFinite(c.pricePerSqm) && c.pricePerSqm > 0);
  if (kept.length === 0 || !(input.surface > 0)) return null;

  const sorted = kept.map((c) => c.pricePerSqm).sort((a, b) => a - b);
  const q1 = quantile(sorted, 0.25);
  const median = quantile(sorted, 0.5);
  const q3 = quantile(sorted, 0.75);
  const adjustmentPct = totalAdjustment(input.adjustments);
  const factor = 1 + adjustmentPct / 100;

  const low = Math.round(q1 * input.surface * factor);
  const mid = Math.round(median * input.surface * factor);
  const high = Math.round(q3 * input.surface * factor);
  const recommendedPrice = input.recommendedOverride && input.recommendedOverride > 0 ? Math.round(input.recommendedOverride) : roundTo(mid);
  const { feesAmount, netSellerPrice } = computeFees(recommendedPrice, input.fees);

  return {
    count: kept.length,
    q1PricePerSqm: Math.round(q1),
    medianPricePerSqm: Math.round(median),
    q3PricePerSqm: Math.round(q3),
    adjustmentPct,
    low,
    mid,
    high,
    recommendedPrice,
    feesAmount,
    netSellerPrice,
    lowConfidence: kept.length < MIN_COMPARABLES,
  };
}
