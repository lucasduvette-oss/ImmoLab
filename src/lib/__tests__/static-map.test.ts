import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { fitZoom, metersPerPixel, project, tilesFor } from "@/lib/static-map";

describe("carte statique (tuiles OpenStreetMap)", () => {
  it("projette comme la formule officielle des tuiles OSM (wiki « Slippy map tilenames »)", () => {
    // xtile = (lon + 180) / 360 × 2^z ; ytile = (1 − asinh(tan(lat)) / π) / 2 × 2^z
    const lat = 47.2184, lon = -1.5536, z = 15;
    const p = project(lat, lon, z);
    expect(Math.floor(p.x / 256)).toBe(Math.floor(((lon + 180) / 360) * 2 ** z));
    expect(Math.floor(p.y / 256)).toBe(Math.floor(((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) * 2 ** z));
    // Repères : (0, 0) est au centre du monde ; la latitude maximale de Web Mercator est en haut.
    expect(project(0, 0, 1)).toEqual({ x: 256, y: 256 });
    expect(project(85.05112878, 0, 0).y).toBeCloseTo(0, 3);
  });

  it("choisit un zoom où le cercle de recherche tient dans l'image", () => {
    const z = fitZoom(47.2184, 500, 1040, 600);
    const diameterPx = 1000 / metersPerPixel(47.2184, z);
    expect(diameterPx).toBeLessThanOrEqual(600 * 0.85);
    expect(1000 / metersPerPixel(47.2184, z + 1)).toBeGreaterThan(600 * 0.85);
  });

  it("couvre toute l'image avec des tuiles", () => {
    const { tiles } = tilesFor(1000.5, 2000.5, 1040, 600, 15);
    // 1040 px de large → 5 ou 6 colonnes ; 600 px de haut → 3 ou 4 lignes
    expect(tiles.length).toBeGreaterThanOrEqual(15);
    expect(tiles.length).toBeLessThanOrEqual(24);
    expect(Math.min(...tiles.map((t) => t.left))).toBeLessThanOrEqual(0);
    expect(Math.max(...tiles.map((t) => t.left + 256))).toBeGreaterThanOrEqual(1040);
  });
});
