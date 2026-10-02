import { z } from "zod";

/**
 * Données échangées entre l'écran d'estimation (navigateur) et le serveur.
 * Le même schéma sert à valider la recherche de comparables et l'enregistrement.
 */

export const subjectSchema = z.object({
  type: z.enum(["appartement", "maison"], { error: "L'estimation DVF concerne les appartements et les maisons." }),
  address: z.string().nullable(),
  postal_code: z.string().nullable(),
  city: z.string().nullable(),
  citycode: z.string().nullable(),
  latitude: z.number({ error: "Adresse non localisée : choisissez une adresse dans les suggestions." }).min(-90).max(90),
  longitude: z.number({ error: "Adresse non localisée : choisissez une adresse dans les suggestions." }).min(-180).max(180),
  surface: z.number({ error: "Indiquez la surface habitable." }).positive("Indiquez la surface habitable."),
  rooms: z.number().int().min(0).nullable(),
});

export const searchSchema = subjectSchema.extend({
  radiusM: z.number().int().min(100).max(5000),
  periodYears: z.number().int().min(1).max(10),
  surfaceTolerancePct: z.number().int().min(5).max(100),
});
export type SearchInput = z.infer<typeof searchSchema>;

export const comparableSchema = z.object({
  id: z.string(),
  date: z.string(),
  type: z.enum(["appartement", "maison"]),
  price: z.number(),
  surface: z.number(),
  rooms: z.number().nullable(),
  landSurface: z.number().nullable(),
  label: z.string().nullable(),
  latitude: z.number(),
  longitude: z.number(),
  distance: z.number(),
  pricePerSqm: z.number(),
  excluded: z.boolean(),
  outlier: z.boolean(),
});

const pct = z.number().min(-100).max(100);

export const estimationPayloadSchema = searchSchema.extend({
  id: z.uuid().nullable(),
  property_id: z.uuid().nullable(),
  data_source: z.string().nullable(),
  comparables: z.array(comparableSchema).max(2000),
  adjustments: z.object({ dpe: pct, etage: pct, exterieur: pct, etat: pct, travaux: pct }),
  fees: z.object({
    mode: z.enum(["pourcentage", "montant"]),
    value: z.number().min(0),
    chargedTo: z.enum(["vendeur", "acquereur"]),
  }),
  recommendedOverride: z.number().positive().nullable(),
  arguments: z.string().max(10000).nullable(),
});
export type EstimationPayload = z.infer<typeof estimationPayloadSchema>;
