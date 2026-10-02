import { z } from "zod";

import { MAX_COMPARABLES, MAX_PERIOD_YEARS, MAX_RADIUS_M, isInDvfArea, totalAdjustment } from "./estimation";
import "./zod-fr";

/**
 * Données échangées entre l'écran d'estimation (navigateur) et le serveur.
 * Le même schéma sert à valider la recherche de comparables et l'enregistrement.
 * Les bornes protègent aussi le serveur : une requête envoyée directement (hors de l'écran)
 * ne peut pas déclencher une recherche démesurée.
 */

const NOT_LOCATED = "Adresse non localisée : choisissez une adresse dans les suggestions.";

/** Plus grand montant enregistrable (colonnes numeric(12,2)). */
export const MAX_AMOUNT = 9_999_999_999;
/** Plus grand prix au m² enregistrable (colonne numeric(10,2)). */
export const MAX_PRICE_SQM = 99_999_999;

export const subjectSchema = z
  .object({
    type: z.enum(["appartement", "maison"], { error: "L'estimation DVF concerne les appartements et les maisons." }),
    address: z.string().max(300).nullable(),
    postal_code: z.string().max(10).nullable(),
    city: z.string().max(150).nullable(),
    // Code INSEE de la commune : 5 chiffres (2A / 2B pour la Corse).
    citycode: z
      .string()
      .regex(/^(\d{5}|2[AB]\d{3})$/, "Code commune invalide.")
      .nullable(),
    latitude: z.number({ error: NOT_LOCATED }).min(-90).max(90),
    longitude: z.number({ error: NOT_LOCATED }).min(-180).max(180),
    surface: z
      .number({ error: "Indiquez la surface habitable." })
      .positive("Indiquez la surface habitable.")
      .max(10000, "Surface habitable trop grande."),
    rooms: z.number().int().min(0, "Nombre de pièces invalide.").max(100, "Nombre de pièces trop grand.").nullable(),
  })
  .refine((s) => isInDvfArea(s.latitude, s.longitude), {
    message: "Adresse hors de la zone couverte par DVF (France métropolitaine, Guadeloupe, Martinique, Guyane, La Réunion).",
    path: ["latitude"],
  });

const searchParamsSchema = z.object({
  radiusM: z.number().int().min(100).max(MAX_RADIUS_M),
  periodYears: z.number().int().min(1).max(MAX_PERIOD_YEARS),
  surfaceTolerancePct: z.number().int().min(5).max(100),
});

export const searchSchema = subjectSchema.and(searchParamsSchema);
export type SearchInput = z.infer<typeof searchSchema>;

export const comparableSchema = z.object({
  id: z.string().max(100),
  date: z.string().max(10),
  type: z.enum(["appartement", "maison"]),
  price: z.number().positive().max(MAX_AMOUNT),
  surface: z.number().positive().max(100000),
  rooms: z.number().nullable(),
  landSurface: z.number().nullable(),
  label: z.string().max(200).nullable(),
  latitude: z.number(),
  longitude: z.number(),
  distance: z.number(),
  pricePerSqm: z.number(),
  excluded: z.boolean(),
  outlier: z.boolean(),
});

const PCT_MESSAGE = "Chaque ajustement doit être compris entre -100 et 100 %.";
const pct = z.number().min(-100, PCT_MESSAGE).max(100, PCT_MESSAGE);

export const estimationPayloadSchema = z
  .object({
    id: z.uuid().nullable(),
    property_id: z.uuid().nullable(),
    data_source: z.string().max(200).nullable(),
    comparables: z
      .array(comparableSchema)
      .max(MAX_COMPARABLES, `Au plus ${MAX_COMPARABLES} ventes : réduisez le rayon ou la période, puis relancez la recherche.`),
    adjustments: z
      .object({ dpe: pct, etage: pct, exterieur: pct, etat: pct, travaux: pct })
      .refine((a) => totalAdjustment(a) > -100, "Le total des ajustements doit rester supérieur à −100 %."),
    fees: z
      .object({
        mode: z.enum(["pourcentage", "montant"]),
        value: z.number().min(0, "Les honoraires ne peuvent pas être négatifs."),
        chargedTo: z.enum(["vendeur", "acquereur"]),
      })
      .refine((f) => (f.mode === "pourcentage" ? f.value <= 100 : f.value <= MAX_AMOUNT), "Honoraires trop élevés."),
    recommendedOverride: z.number().positive().max(MAX_AMOUNT, "Prix conseillé trop élevé.").nullable(),
    arguments: z.string().max(10000).nullable(),
  })
  .and(subjectSchema)
  .and(searchParamsSchema);
export type EstimationPayload = z.infer<typeof estimationPayloadSchema>;
