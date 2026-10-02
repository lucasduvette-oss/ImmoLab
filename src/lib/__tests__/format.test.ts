import { describe, expect, it } from "vitest";

import {
  addDaysISO,
  daysBetween,
  formatDate,
  formatEuros,
  formatPhone,
  parisDayRange,
  parisLocalToUTC,
  parseFrenchNumber,
  utcToParisLocal,
} from "@/lib/format";
import { normalizeSearch } from "@/lib/search";

// Espace insécable fine utilisée par Intl en français
const nbsp = (s: string) => s.replace(/[\u202f\u00a0]/g, " ");

describe("mise en forme française", () => {
  it("formate les euros sans décimales", () => {
    expect(nbsp(formatEuros(350000))).toBe("350 000 €");
    expect(formatEuros(null)).toBe("—");
  });

  it("formate les dates au format JJ/MM/AAAA", () => {
    expect(formatDate("2026-10-05")).toBe("05/10/2026");
  });

  it("formate les numéros de téléphone français", () => {
    expect(formatPhone("0639981006")).toBe("06 39 98 10 06");
    expect(formatPhone("+44 20 7946 0000")).toBe("+44 20 7946 0000");
  });

  it("calcule des écarts de jours", () => {
    expect(addDaysISO("2026-12-30", 3)).toBe("2027-01-02");
    expect(daysBetween("2026-10-01", "2026-10-31")).toBe(30);
  });
});

describe("heure de Paris", () => {
  it("convertit l'heure locale en UTC (heure d'été et d'hiver)", () => {
    expect(parisLocalToUTC("2026-07-01T10:00")).toBe("2026-07-01T08:00:00.000Z");
    expect(parisLocalToUTC("2026-12-01T10:00")).toBe("2026-12-01T09:00:00.000Z");
  });

  it("fait l'aller-retour UTC → heure locale", () => {
    expect(utcToParisLocal("2026-07-01T08:00:00.000Z")).toBe("2026-07-01T10:00");
  });

  it("donne les bornes de la journée", () => {
    expect(parisDayRange("2026-10-01")).toEqual({
      start: "2026-09-30T22:00:00.000Z",
      end: "2026-10-01T22:00:00.000Z",
    });
  });
});

describe("recherche", () => {
  it("retire accents et majuscules", () => {
    expect(normalizeSearch("  Hélène ")).toBe("helene");
  });
  it("compacte les numéros de téléphone", () => {
    expect(normalizeSearch("06 39 98")).toBe("063998");
  });
  it("neutralise les jokers SQL", () => {
    expect(normalizeSearch("50%_x")).toBe("50 x");
  });
});

describe("saisie de nombres", () => {
  it("lit les nombres écrits à la française", () => {
    expect(parseFrenchNumber("72,5")).toBe(72.5);
    expect(parseFrenchNumber("350 000")).toBe(350000);
    expect(parseFrenchNumber("350\u202f000 €")).toBe(350000);
    expect(parseFrenchNumber("-5")).toBe(-5);
    expect(parseFrenchNumber("\u22123")).toBe(-3);
    expect(parseFrenchNumber("65.5")).toBe(65.5);
  });
  it("comprend le point comme séparateur de milliers", () => {
    expect(parseFrenchNumber("280.000")).toBe(280000);
    expect(parseFrenchNumber("1.250.000")).toBe(1250000);
    // un nombre commençant par 0 n'est pas groupé par milliers
    expect(parseFrenchNumber("0.500")).toBe(0.5);
    expect(parseFrenchNumber("-0.250")).toBe(-0.25);
  });
  it("renvoie null pour une saisie vide ou invalide", () => {
    expect(parseFrenchNumber("")).toBeNull();
    expect(parseFrenchNumber("-")).toBeNull();
    expect(parseFrenchNumber("abc")).toBeNull();
  });
});
