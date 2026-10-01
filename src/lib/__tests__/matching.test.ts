import { describe, expect, it } from "vitest";

import { matchDetailLabel, scoreTone } from "@/lib/matching";

const clean = (s: string) => s.replace(/[  ]/g, " ");

describe("rapprochement", () => {
  it("rédige les critères en français", () => {
    expect(clean(matchDetailLabel({ key: "prix", ok: true, value: 315000, target: 320000 }))).toBe("Prix 315 000 € (budget 320 000 €)");
    expect(clean(matchDetailLabel({ key: "surface", ok: false, value: 58, target: 60 }))).toBe("58 m² (min. 60 m²)");
    expect(matchDetailLabel({ key: "pieces", ok: null })).toBe("Pièces non renseignées");
    expect(matchDetailLabel({ key: "ascenseur", ok: false })).toBe("Ascenseur");
    expect(matchDetailLabel({ key: "exterieur", ok: true })).toBe("Extérieur");
    expect(matchDetailLabel({ key: "type", ok: true, value: "maison" })).toBe("Maison");
  });

  it("classe les scores", () => {
    expect(scoreTone(100)).toBe("high");
    expect(scoreTone(73)).toBe("medium");
    expect(scoreTone(55)).toBe("low");
  });
});
