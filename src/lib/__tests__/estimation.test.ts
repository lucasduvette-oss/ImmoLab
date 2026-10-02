import { describe, expect, it } from "vitest";

import {
  NO_ADJUSTMENTS,
  boundingBox,
  computeEstimation,
  computeFees,
  distanceMeters,
  flagOutliers,
  quantile,
  roundTo,
  splitBoundingBox,
} from "@/lib/estimation";

describe("géographie", () => {
  it("calcule une distance réaliste (place Royale → cathédrale de Nantes ≈ 650 m)", () => {
    const d = distanceMeters(47.2151, -1.5585, 47.218, -1.5505);
    expect(d).toBeGreaterThan(600);
    expect(d).toBeLessThan(720);
  });

  it("construit un rectangle contenant le cercle de recherche", () => {
    const box = boundingBox(47.2184, -1.5536, 500);
    // les coins du rectangle sont à ~500 m du centre dans chaque axe
    expect(distanceMeters(47.2184, -1.5536, box.maxLat, -1.5536)).toBeCloseTo(500, 0);
    expect(distanceMeters(47.2184, -1.5536, 47.2184, box.maxLon)).toBeCloseTo(500, -1);
  });

  it("découpe une grande zone en carreaux de 0,02° au plus", () => {
    const box = boundingBox(47.2184, -1.5536, 2000);
    const tiles = splitBoundingBox(box, 0.02);
    expect(tiles.length).toBeGreaterThan(1);
    for (const t of tiles) {
      expect(t.maxLat - t.minLat).toBeLessThanOrEqual(0.02 + 1e-9);
      expect(t.maxLon - t.minLon).toBeLessThanOrEqual(0.02 + 1e-9);
    }
    // les carreaux couvrent exactement la zone
    expect(Math.min(...tiles.map((t) => t.minLat))).toBeCloseTo(box.minLat, 9);
    expect(Math.max(...tiles.map((t) => t.maxLon))).toBeCloseTo(box.maxLon, 9);
    // une petite zone n'est pas découpée
    expect(splitBoundingBox(boundingBox(47.2, -1.55, 500), 0.02)).toHaveLength(1);
  });
});

describe("statistiques", () => {
  it("calcule quartiles et médiane comme un tableur", () => {
    const s = [1000, 2000, 3000, 4000, 5000];
    expect(quantile(s, 0.5)).toBe(3000);
    expect(quantile(s, 0.25)).toBe(2000);
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5);
  });

  it("signale les prix au m² atypiques à partir de 5 ventes", () => {
    const items = [3800, 4000, 4100, 4200, 4300, 4500, 12000].map((p) => ({ pricePerSqm: p }));
    const flagged = flagOutliers(items);
    expect(flagged.filter((f) => f.outlier).map((f) => f.pricePerSqm)).toEqual([12000]);
    expect(flagOutliers(items.slice(0, 3)).some((f) => f.outlier)).toBe(false);
  });
});

describe("estimation", () => {
  const comparables = [3600, 3900, 4000, 4200, 4400].map((p) => ({ pricePerSqm: p, excluded: false }));
  const fees = { mode: "pourcentage" as const, value: 5, chargedTo: "vendeur" as const };

  it("calcule la fourchette à partir des quartiles et de la médiane", () => {
    const r = computeEstimation({ comparables, surface: 70, adjustments: NO_ADJUSTMENTS, fees })!;
    expect(r.count).toBe(5);
    expect(r.medianPricePerSqm).toBe(4000);
    expect(r.low).toBe(3900 * 70);
    expect(r.mid).toBe(4000 * 70);
    expect(r.high).toBe(4200 * 70);
    expect(r.recommendedPrice).toBe(280000);
    expect(r.lowConfidence).toBe(false);
  });

  it("applique les ajustements en %", () => {
    const r = computeEstimation({
      comparables,
      surface: 70,
      adjustments: { ...NO_ADJUSTMENTS, dpe: -5, exterieur: 3 },
      fees,
    })!;
    expect(r.adjustmentPct).toBe(-2);
    expect(r.mid).toBe(Math.round(4000 * 70 * 0.98));
  });

  it("ignore les comparables exclus et signale un échantillon faible", () => {
    const r = computeEstimation({
      comparables: [...comparables.slice(0, 3), { pricePerSqm: 9000, excluded: true }],
      surface: 50,
      adjustments: NO_ADJUSTMENTS,
      fees,
    })!;
    expect(r.count).toBe(3);
    expect(r.medianPricePerSqm).toBe(3900);
    expect(r.lowConfidence).toBe(true);
  });

  it("respecte un prix conseillé saisi par l'agent", () => {
    const r = computeEstimation({ comparables, surface: 70, adjustments: NO_ADJUSTMENTS, fees, recommendedOverride: 289000 })!;
    expect(r.recommendedPrice).toBe(289000);
    expect(r.netSellerPrice).toBe(289000 - 14450);
  });

  it("renvoie null sans comparable ou sans surface", () => {
    expect(computeEstimation({ comparables: [], surface: 70, adjustments: NO_ADJUSTMENTS, fees })).toBeNull();
    expect(computeEstimation({ comparables, surface: 0, adjustments: NO_ADJUSTMENTS, fees })).toBeNull();
  });
});

describe("honoraires et net vendeur", () => {
  it("honoraires vendeur en % du prix", () => {
    expect(computeFees(300000, { mode: "pourcentage", value: 5, chargedTo: "vendeur" })).toEqual({ feesAmount: 15000, netSellerPrice: 285000 });
  });
  it("honoraires acquéreur en % du net vendeur (prix affiché honoraires inclus)", () => {
    // 315 000 € FAI avec 5 % d'honoraires sur le net → net 300 000 €, honoraires 15 000 €
    expect(computeFees(315000, { mode: "pourcentage", value: 5, chargedTo: "acquereur" })).toEqual({ feesAmount: 15000, netSellerPrice: 300000 });
  });
  it("honoraires en montant", () => {
    expect(computeFees(300000, { mode: "montant", value: 12000, chargedTo: "acquereur" })).toEqual({ feesAmount: 12000, netSellerPrice: 288000 });
  });
  it("arrondit au millier", () => {
    expect(roundTo(284499)).toBe(284000);
    expect(roundTo(284500)).toBe(285000);
  });
});
