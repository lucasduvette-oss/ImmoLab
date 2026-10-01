/**
 * Listes de valeurs de l'application et leurs libellés en français.
 * Les clés (à gauche) sont celles enregistrées en base : ne pas les modifier
 * sans adapter les contraintes « check » des migrations SQL.
 */

/** Transforme un objet { clé: libellé } en liste d'options pour un menu déroulant. */
export function toOptions<T extends Record<string, string>>(labels: T) {
  return Object.entries(labels).map(([value, label]) => ({ value: value as keyof T & string, label }));
}

// ---------------------------------------------------------------- Contacts

export const CONTACT_SOURCES = {
  pige: "Pige",
  recommandation: "Recommandation",
  boitage: "Boîtage",
  portail: "Portail",
  autre: "Autre",
} as const;
export type ContactSource = keyof typeof CONTACT_SOURCES;

export const CONTACT_ROLES = {
  vendeur: "Vendeur",
  acquereur: "Acquéreur",
  prospect: "Prospect",
  partenaire: "Partenaire",
} as const;
export type ContactRole = keyof typeof CONTACT_ROLES;

export const PARTNER_TYPES = {
  notaire: "Notaire",
  courtier: "Courtier",
  diagnostiqueur: "Diagnostiqueur",
  artisan: "Artisan",
  autre: "Autre",
} as const;
export type PartnerType = keyof typeof PARTNER_TYPES;

/** Pipeline vendeurs : prospect → estimation → mandat → vendu / perdu */
export const SELLER_STAGES = {
  prospect: "Prospect",
  estimation: "Estimation",
  mandat: "Mandat",
  vendu: "Vendu",
  perdu: "Perdu",
} as const;
export type SellerStage = keyof typeof SELLER_STAGES;

/** Pipeline acquéreurs : nouveau → qualifié → en visite → offre → acheté / perdu */
export const BUYER_STAGES = {
  nouveau: "Nouveau",
  qualifie: "Qualifié",
  en_visite: "En visite",
  offre: "Offre",
  achete: "Acheté",
  perdu: "Perdu",
} as const;
export type BuyerStage = keyof typeof BUYER_STAGES;

/** Étapes « terminées » : l'acquéreur ou le vendeur ne fait plus l'objet de relances. */
export const CLOSED_BUYER_STAGES: BuyerStage[] = ["achete", "perdu"];

export const INTERACTION_KINDS = {
  appel: "Appel",
  sms: "SMS",
  email: "Mail",
  rdv: "Rendez-vous",
  visite: "Visite",
  note: "Note",
} as const;
export type InteractionKind = keyof typeof INTERACTION_KINDS;

export const TIMEFRAMES = {
  immediat: "Immédiat",
  "3_mois": "Sous 3 mois",
  "6_mois": "3 à 6 mois",
  plus_6_mois: "Plus de 6 mois",
} as const;
export type Timeframe = keyof typeof TIMEFRAMES;

// ---------------------------------------------------------------- Biens

export const PROPERTY_TYPES = {
  appartement: "Appartement",
  maison: "Maison",
  terrain: "Terrain",
  local: "Local commercial",
  immeuble: "Immeuble",
  parking: "Parking / box",
  autre: "Autre",
} as const;
export type PropertyType = keyof typeof PROPERTY_TYPES;

/** Critères indispensables d'un acquéreur (comparés aux caractéristiques des biens). */
export const MUST_HAVES = {
  exterieur: "Extérieur (balcon, terrasse ou jardin)",
  jardin: "Jardin",
  parking: "Parking / garage",
  ascenseur: "Ascenseur",
} as const;
export type MustHave = keyof typeof MUST_HAVES;
