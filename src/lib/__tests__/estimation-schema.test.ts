import { describe, expect, it } from "vitest";

import { NO_ADJUSTMENTS } from "@/lib/estimation";
import { estimationPayloadSchema, searchSchema } from "@/lib/estimation-schema";

const search = {
  type: "appartement" as const,
  address: "56 Boulevard Guist'hau",
  postal_code: "44000",
  city: "Nantes",
  citycode: "44109",
  latitude: 47.2172,
  longitude: -1.5652,
  surface: 70,
  rooms: 3,
  radiusM: 500,
  periodYears: 3,
  surfaceTolerancePct: 20,
};

const payload = {
  ...search,
  id: null,
  property_id: null,
  data_source: "DVF",
  comparables: [],
  adjustments: NO_ADJUSTMENTS,
  fees: { mode: "pourcentage" as const, value: 5, chargedTo: "vendeur" as const },
  recommendedOverride: null,
  arguments: null,
};

const firstMessage = (r: { success: boolean; error?: { issues: { message: string }[] } }) => r.error?.issues[0]?.message;

describe("validation des recherches DVF", () => {
  it("accepte une recherche normale", () => {
    expect(searchSchema.safeParse(search).success).toBe(true);
    expect(searchSchema.safeParse({ ...search, citycode: "2A004" }).success).toBe(true);
    expect(searchSchema.safeParse({ ...search, citycode: null }).success).toBe(true);
  });

  it("refuse un code commune qui n'en est pas un (il sert à construire une adresse de fichier)", () => {
    expect(searchSchema.safeParse({ ...search, citycode: "../../../../etc/passwd?" }).success).toBe(false);
    expect(searchSchema.safeParse({ ...search, citycode: "4410" }).success).toBe(false);
  });

  it("refuse un point hors de la zone couverte par DVF", () => {
    const r = searchSchema.safeParse({ ...search, latitude: 90, longitude: 0 });
    expect(r.success).toBe(false);
    expect(firstMessage(r)).toMatch(/zone couverte par DVF/);
  });

  it("limite le rayon et la période à ceux proposés à l'écran", () => {
    expect(searchSchema.safeParse({ ...search, radiusM: 5000 }).success).toBe(false);
    expect(searchSchema.safeParse({ ...search, periodYears: 10 }).success).toBe(false);
  });
});

describe("validation de l'enregistrement", () => {
  it("accepte une estimation normale", () => {
    expect(estimationPayloadSchema.safeParse(payload).success).toBe(true);
  });

  it("refuse des ajustements totalisant -100 % ou moins, avec un message en français", () => {
    const r = estimationPayloadSchema.safeParse({ ...payload, adjustments: { ...NO_ADJUSTMENTS, etat: -60, travaux: -40 } });
    expect(r.success).toBe(false);
    expect(firstMessage(r)).toMatch(/total des ajustements/);
    expect(firstMessage(estimationPayloadSchema.safeParse({ ...payload, adjustments: { ...NO_ADJUSTMENTS, dpe: 150 } }))).toMatch(/entre -100 et 100/);
  });

  it("refuse des honoraires négatifs ou démesurés", () => {
    expect(firstMessage(estimationPayloadSchema.safeParse({ ...payload, fees: { ...payload.fees, value: -2 } }))).toMatch(/négatifs/);
    expect(estimationPayloadSchema.safeParse({ ...payload, fees: { ...payload.fees, value: 150 } }).success).toBe(false);
  });
});
