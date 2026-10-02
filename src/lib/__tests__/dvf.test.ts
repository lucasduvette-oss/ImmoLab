import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
// Géocodage inverse simulé : l'est du point de départ est sur la commune voisine (Rezé).
vi.mock("@/lib/geocoding", () => ({
  reverseCitycode: vi.fn(async (_lat: number, lon: number) => (lon > -1.5652 ? "44143" : "44109")),
}));

import { ceremaToComparable, findComparablesCerema, geometryCenter, type CeremaFeature } from "@/lib/dvf/cerema";
import { assertCovered, fetchWithRetry, finalizeComparables, periodStart, readJson, readText, toNumber } from "@/lib/dvf/common";
import { parseCsv } from "@/lib/dvf/csv";
import { departmentOf, findComparablesGeoDvf, reduceGeoDvfRows, samplePoints } from "@/lib/dvf/geodvf";
import { DvfUnavailableError } from "@/lib/dvf/types";
import { distanceMeters, MAX_COMPARABLES, type Comparable } from "@/lib/estimation";

afterEach(() => {
  vi.unstubAllGlobals();
});

const subject = {
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
  minDate: "2023-10-02",
};

/** Petit carré de parcelle centré sur un point. */
const square = (lon: number, lat: number, d = 0.0001) => ({
  type: "MultiPolygon",
  coordinates: [[[[lon - d, lat - d], [lon + d, lat - d], [lon + d, lat + d], [lon - d, lat + d], [lon - d, lat - d]]]],
});

/** Vente type renvoyée par /dvf_opendata/geomutations/?fields=all (décimaux en texte). */
const feature = (props: Record<string, unknown> = {}, geometry: unknown = square(-1.566, 47.218)): CeremaFeature => ({
  type: "Feature",
  id: 5852,
  geometry,
  properties: {
    idmutinvar: "274db1bcf6991ca07cfe0f641ca5c7b8",
    datemut: "2024-05-12",
    anneemut: 2024,
    libnatmut: "Vente",
    vefa: false,
    valeurfonc: "285000.00",
    sbati: "68.00",
    sbatapt: "68.00",
    sbatmai: "0.00",
    sterr: "0.00",
    codtypbien: "121",
    libtypbien: "UN APPARTEMENT",
    nblocmut: 2,
    nblocapt: 1,
    nblocmai: 0,
    nblocdep: 1,
    nblocact: 0,
    nbapt3pp: 1,
    l_codinsee: ["44109"],
    ...props,
  },
} as CeremaFeature);

describe("API DVF du Cerema", () => {
  it("convertit une vente d'appartement (décimaux en texte, dépendance acceptée)", () => {
    const c = ceremaToComparable(feature(), subject)!;
    expect(c).not.toBeNull();
    expect(c.price).toBe(285000);
    expect(c.surface).toBe(68);
    expect(c.rooms).toBe(3);
    expect(c.label).toBe("Nantes");
    expect(Math.round(c.pricePerSqm)).toBe(4191);
    expect(c.distance).toBeLessThan(200);
    expect(c.id).toBe("cerema-274db1bcf6991ca07cfe0f641ca5c7b8");
  });

  it("écarte VEFA, échanges, ventes de plusieurs logements et autres types", () => {
    expect(ceremaToComparable(feature({ libnatmut: "Vente en l'état futur d'achèvement" }), subject)).toBeNull();
    expect(ceremaToComparable(feature({ libnatmut: "Echange" }), subject)).toBeNull();
    expect(ceremaToComparable(feature({ vefa: true }), subject)).toBeNull();
    expect(ceremaToComparable(feature({ nblocapt: 2 }), subject)).toBeNull();
    expect(ceremaToComparable(feature({ nblocact: 1 }), subject)).toBeNull();
    expect(ceremaToComparable(feature({ codtypbien: "120", libtypbien: "APPARTEMENT INDETERMINE" }), subject)).toBeNull();
    expect(ceremaToComparable(feature({ codtypbien: "111" }), subject)).toBeNull();
  });

  it("filtre période, surface, prix symbolique, distance et géométrie absente", () => {
    expect(ceremaToComparable(feature({ datemut: "2022-01-10" }), subject)).toBeNull();
    expect(ceremaToComparable(feature({ sbati: "40.00", sbatapt: "40.00" }), subject)).toBeNull();
    expect(ceremaToComparable(feature({ valeurfonc: "1.00" }), subject)).toBeNull();
    expect(ceremaToComparable(feature({}, square(-1.58, 47.23)), subject)).toBeNull(); // ~1,7 km
    expect(ceremaToComparable(feature({}, null), subject)).toBeNull();
  });

  it("calcule le centre des parcelles", () => {
    const c = geometryCenter(square(-1.5, 47.2) as never)!;
    expect(c.longitude).toBeCloseTo(-1.5, 6);
    expect(c.latitude).toBeCloseTo(47.2, 6);
    // Polygon simple (et non MultiPolygon)
    const polygon = { type: "Polygon", coordinates: square(-1.5, 47.2).coordinates[0] };
    expect(geometryCenter(polygon as never)!.latitude).toBeCloseTo(47.2, 6);
  });

  it("place une vente sur sa parcelle la plus proche (parcelle bâtie + terrain éloigné)", () => {
    // Petite parcelle près du bien + grand terrain (beaucoup de sommets) à ~3 km.
    const farLon = -1.525;
    const far = Array.from({ length: 120 }, (_, i) => [farLon + 0.001 * Math.cos(i / 19), 47.218 + 0.001 * Math.sin(i / 19)]);
    const geometry = { type: "MultiPolygon", coordinates: [square(-1.566, 47.218).coordinates[0], [[...far, far[0]]]] };
    const c = ceremaToComparable(feature({}, geometry), subject);
    expect(c).not.toBeNull();
    expect(c!.distance).toBeLessThan(200);
    expect(c!.longitude).toBeCloseTo(-1.566, 4);
  });

  it("n'affiche le nom de commune que pour celle du bien", () => {
    expect(ceremaToComparable(feature(), subject)!.label).toBe("Nantes");
    expect(ceremaToComparable(feature({ l_codinsee: ["44143"] }), subject)!.label).toBeNull();
  });

  it("bascule vers le repli si la réponse n'est pas une liste de ventes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ detail: "Limite atteinte" }), { headers: { "content-type": "application/json" } })),
    );
    await expect(findComparablesCerema(subject)).rejects.toBeInstanceOf(DvfUnavailableError);
  });

  it("lit les pages successives et convertit les ventes", async () => {
    const pages = [
      { features: [feature()], next: "page-2" },
      { features: [feature({ idmutinvar: "autre" })], next: null },
    ];
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(pages.shift()), { headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const { comparables, truncated } = await findComparablesCerema({ ...subject, radiusM: 300 });
    expect(comparables).toHaveLength(2);
    expect(truncated).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("fichiers geo-dvf (repli)", () => {
  const header =
    "id_mutation,date_mutation,numero_disposition,nature_mutation,valeur_fonciere,adresse_numero,adresse_suffixe,adresse_nom_voie,adresse_code_voie,code_postal,code_commune,nom_commune,code_departement,ancien_code_commune,ancien_nom_commune,id_parcelle,ancien_id_parcelle,numero_volume,lot1_numero,lot1_surface_carrez,lot2_numero,lot2_surface_carrez,lot3_numero,lot3_surface_carrez,lot4_numero,lot4_surface_carrez,lot5_numero,lot5_surface_carrez,nombre_lots,code_type_local,type_local,surface_reelle_bati,nombre_pieces_principales,code_nature_culture,nature_culture,code_nature_culture_speciale,nature_culture_speciale,surface_terrain,longitude,latitude";
  const row = (cells: Record<string, string>) =>
    header
      .split(",")
      .map((h) => {
        const v = cells[h] ?? "";
        return v.includes(",") ? `"${v}"` : v;
      })
      .join(",");
  const base = {
    date_mutation: "2024-03-15",
    nature_mutation: "Vente",
    valeur_fonciere: "280000",
    adresse_numero: "12",
    adresse_nom_voie: "RUE CREBILLON",
    code_postal: "44000",
    code_commune: "44109",
    nom_commune: "Nantes",
    id_parcelle: "44109000AB0012",
    longitude: "-1.5604",
    latitude: "47.2133",
  };
  const csv = [
    header,
    // Vente 1 : un appartement + une cave (dépendance), ligne de l'appartement en double
    row({ ...base, id_mutation: "2024-1", code_type_local: "2", type_local: "Appartement", surface_reelle_bati: "70", nombre_pieces_principales: "3" }),
    row({ ...base, id_mutation: "2024-1", code_type_local: "2", type_local: "Appartement", surface_reelle_bati: "70", nombre_pieces_principales: "3" }),
    row({ ...base, id_mutation: "2024-1", code_type_local: "3", type_local: "Dépendance" }),
    // Vente 2 : deux appartements → écartée
    row({ ...base, id_mutation: "2024-2", valeur_fonciere: "500000", code_type_local: "2", surface_reelle_bati: "50" }),
    row({ ...base, id_mutation: "2024-2", valeur_fonciere: "500000", code_type_local: "2", surface_reelle_bati: "60" }),
    // Vente 3 : VEFA → écartée
    row({ ...base, id_mutation: "2024-3", nature_mutation: "Vente en l'état futur d'achèvement", code_type_local: "2", surface_reelle_bati: "65" }),
    // Vente 4 : maison avec deux parcelles de terrain, adresse contenant une virgule
    row({ ...base, id_mutation: "2024-4", valeur_fonciere: "410000", adresse_nom_voie: "ALLEE DES ROSES, BAT A", code_type_local: "1", type_local: "Maison", surface_reelle_bati: "110", nombre_pieces_principales: "5", surface_terrain: "300" }),
    row({ ...base, id_mutation: "2024-4", valeur_fonciere: "410000", id_parcelle: "44109000AB0013", surface_terrain: "150" }),
  ].join("\n");

  it("lit un CSV avec guillemets et BOM", () => {
    const rows = parseCsv(`﻿a,b\n"1,5",x\n2,"y ""z"""\n`);
    expect(rows).toEqual([
      { a: "1,5", b: "x" },
      { a: "2", b: 'y "z"' },
    ]);
  });

  it("reconstitue une vente par mutation (un seul logement)", () => {
    const sales = reduceGeoDvfRows(parseCsv(csv));
    expect(sales.map((s) => s.type).sort()).toEqual(["appartement", "maison"]);
    const apt = sales.find((s) => s.type === "appartement")!;
    expect(apt).toMatchObject({ price: 280000, surface: 70, rooms: 3, label: "12 RUE CREBILLON, Nantes" });
    const house = sales.find((s) => s.type === "maison")!;
    expect(house.landSurface).toBe(450);
    expect(house.label).toBe("12 ALLEE DES ROSES, BAT A, Nantes");
  });

  it("additionne les natures de culture d'une même parcelle (sol + jardin)", () => {
    const land = [
      header,
      row({ ...base, id_mutation: "2024-9", valeur_fonciere: "390000", code_type_local: "1", type_local: "Maison", surface_reelle_bati: "100", nombre_pieces_principales: "4", code_nature_culture: "S", surface_terrain: "150" }),
      row({ ...base, id_mutation: "2024-9", valeur_fonciere: "390000", code_type_local: "1", type_local: "Maison", surface_reelle_bati: "100", nombre_pieces_principales: "4", code_nature_culture: "J", surface_terrain: "600" }),
    ].join("\n");
    const [house] = reduceGeoDvfRows(parseCsv(land));
    expect(house.landSurface).toBe(750);
  });

  it("répartit des points de recherche dans tout le cercle", () => {
    const points = samplePoints(47.2172, -1.5652, 3000);
    expect(points.length).toBeGreaterThan(60);
    expect(points.length).toBeLessThan(150);
    for (const [lat, lon] of points) expect(distanceMeters(47.2172, -1.5652, lat, lon)).toBeLessThanOrEqual(3001);
    // Aucun « trou » de plus de 600 m entre un point quelconque du cercle et le point le plus proche.
    const probe = [47.2172 + 0.009, -1.5652 + 0.004] as const;
    expect(Math.min(...points.map(([lat, lon]) => distanceMeters(probe[0], probe[1], lat, lon)))).toBeLessThan(600);
  });

  it("continue sans une commune voisine indisponible, en le signalant", async () => {
    const sale = { ...base, latitude: "47.2175", longitude: "-1.5655", id_mutation: "2025-1", date_mutation: "2025-03-15" };
    const csvNantes = [header, row({ ...sale, code_type_local: "2", type_local: "Appartement", surface_reelle_bati: "70", nombre_pieces_principales: "3" })].join("\n");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/44143.csv")) throw new TypeError("fetch failed");
        if (url.includes("/2025/") && url.includes("/44109.csv")) return new Response(csvNantes);
        return new Response("", { status: 404 });
      }),
    );
    const { comparables, notes } = await findComparablesGeoDvf({ ...subject, citycode: "44109" });
    expect(comparables).toHaveLength(1);
    expect(notes.join(" ")).toMatch(/44143/);
  });

  it("échoue si les ventes de la commune du bien sont indisponibles", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );
    // Commune du bien sans fichier en mémoire (les fichiers déjà lus sont gardés 12 h).
    await expect(findComparablesGeoDvf({ ...subject, citycode: "44020" })).rejects.toBeInstanceOf(DvfUnavailableError);
  });

  it("calcule le dossier du département", () => {
    expect(departmentOf("44109")).toBe("44");
    expect(departmentOf("2A004")).toBe("2A");
    expect(departmentOf("97411")).toBe("974");
  });
});

describe("règles communes", () => {
  it("refuse l'Alsace, la Moselle et Mayotte", () => {
    expect(() => assertCovered("67482", "67000")).toThrow(/Alsace/);
    expect(() => assertCovered(null, "57000")).toThrow();
    expect(() => assertCovered("97611", null)).toThrow();
    expect(() => assertCovered("44109", "44000")).not.toThrow();
  });

  it("lit les nombres texte ou numériques", () => {
    expect(toNumber("285000.00")).toBe(285000);
    expect(toNumber(12)).toBe(12);
    expect(toNumber("")).toBeNull();
    expect(toNumber(null)).toBeNull();
  });

  it("calcule le début de période", () => {
    expect(periodStart("2026-10-02", 3)).toBe("2023-10-02");
  });

  it("dédoublonne, trie par distance et pré-exclut les prix atypiques", () => {
    const mk = (id: string, ppsm: number, distance: number): Comparable => ({
      id, date: "2025-01-01", type: "appartement", price: ppsm * 70, surface: 70, rooms: 3, landSurface: null, label: null,
      latitude: 0, longitude: 0, distance, pricePerSqm: ppsm, excluded: false, outlier: false,
    });
    const { comparables, notes } = finalizeComparables([
      mk("a", 4000, 300), mk("b", 4100, 100), mk("c", 3900, 200), mk("d", 4200, 50), mk("e", 4050, 400), mk("f", 12000, 250), mk("a", 4000, 300),
    ]);
    expect(comparables.map((c) => c.id)).toEqual(["d", "b", "c", "f", "a", "e"]);
    expect(comparables.find((c) => c.id === "f")).toMatchObject({ outlier: true, excluded: true });
    expect(notes[0]).toMatch(/atypique/);
  });
});

describe("lecture des réponses", () => {
  const stream = (chunks: string[], fail = false) =>
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const c of chunks) controller.enqueue(new TextEncoder().encode(c));
        if (fail) controller.error(new TypeError("terminated"));
        else controller.close();
      },
    });

  it("lit un texte et un JSON", async () => {
    expect(await readText(new Response(stream(["abc", "déf"])), 1000)).toBe("abcdéf");
    expect(await readJson(new Response('{"a":1}'), 1000)).toEqual({ a: 1 });
  });

  it("transforme une coupure, un JSON tronqué ou une réponse trop lourde en service indisponible", async () => {
    await expect(readText(new Response(stream(["abc"], true)), 1000)).rejects.toBeInstanceOf(DvfUnavailableError);
    await expect(readJson(new Response('{"features": ['), 1000)).rejects.toBeInstanceOf(DvfUnavailableError);
    await expect(readText(new Response(stream(["x".repeat(600), "y".repeat(600)])), 1000)).rejects.toThrow(/volumineuse/);
    await expect(readText(new Response("abc", { headers: { "content-length": "5000" } }), 1000)).rejects.toThrow(/volumineuse/);
  });

  it("respecte le délai global de la recherche", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("ok")));
    await expect(fetchWithRetry("https://exemple.fr", { timeoutMs: 1000, deadline: AbortSignal.abort() })).rejects.toThrow(/trop de temps/);
  });

  it("retente une fois après une coupure réseau si demandé", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);
    const res = await fetchWithRetry("https://exemple.fr", { timeoutMs: 1000, retries: 1, retryNetworkErrors: true });
    expect(await res.text()).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("limite du nombre de ventes", () => {
  it(`ne garde que les ${MAX_COMPARABLES} ventes les plus proches, en le signalant`, () => {
    const many: Comparable[] = Array.from({ length: MAX_COMPARABLES + 100 }, (_, i) => ({
      id: `v${i}`, date: "2025-01-01", type: "appartement", price: 280000, surface: 70, rooms: 3, landSurface: null, label: null,
      latitude: 0, longitude: 0, distance: MAX_COMPARABLES + 100 - i, pricePerSqm: 4000, excluded: false, outlier: false,
    }));
    const { comparables, notes } = finalizeComparables(many);
    expect(comparables).toHaveLength(MAX_COMPARABLES);
    expect(comparables[0].distance).toBe(1);
    expect(notes[0]).toMatch(/plus proches/);
  });
});
