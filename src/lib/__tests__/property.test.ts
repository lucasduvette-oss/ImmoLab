import { describe, expect, it } from "vitest";

import { parseGeocodingResponse } from "@/lib/geocoding";
import { mandateAlert, mandateAlertText, propertyTitle } from "@/lib/property";

describe("biens", () => {
  it("construit un titre lisible", () => {
    expect(propertyTitle({ type: "appartement", rooms: 3, surface: 68, city: "Nantes" }).replace(/\u00a0/g, " ")).toBe(
      "Appartement 3 pièces · 68 m² · Nantes",
    );
  });

  it("alerte 30 jours avant l'échéance du mandat", () => {
    expect(mandateAlert({ mandate_end: "2026-11-15", status: "en_vente" }, "2026-10-01")).toBeNull();
    expect(mandateAlert({ mandate_end: "2026-10-31", status: "en_vente" }, "2026-10-01")).toEqual({ daysLeft: 30, expired: false });
    expect(mandateAlert({ mandate_end: "2026-09-28", status: "en_vente" }, "2026-10-01")).toEqual({ daysLeft: -3, expired: true });
    // Pas d'alerte pour un bien vendu
    expect(mandateAlert({ mandate_end: "2026-10-10", status: "vendu" }, "2026-10-01")).toBeNull();
    expect(mandateAlertText({ daysLeft: 12, expired: false })).toBe("Mandat : échéance dans 12 jours");
  });
});

describe("géocodage", () => {
  it("lit la réponse GeoJSON de la Géoplateforme", () => {
    const json = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [-1.5604, 47.2133] },
          properties: {
            label: "12 Rue Crébillon 44000 Nantes",
            score: 0.97,
            housenumber: "12",
            name: "12 Rue Crébillon",
            postcode: "44000",
            citycode: "44109",
            city: "Nantes",
            type: "housenumber",
            street: "Rue Crébillon",
          },
        },
      ],
    };
    expect(parseGeocodingResponse(json)).toEqual([
      {
        label: "12 Rue Crébillon 44000 Nantes",
        street: "12 Rue Crébillon",
        postalCode: "44000",
        city: "Nantes",
        citycode: "44109",
        latitude: 47.2133,
        longitude: -1.5604,
        score: 0.97,
      },
    ]);
    expect(parseGeocodingResponse({ error: "x" })).toEqual([]);
  });
});
