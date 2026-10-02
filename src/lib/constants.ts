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

export const PROPERTY_STATUSES = {
  estimation: "Estimation",
  en_vente: "En vente",
  sous_offre: "Sous offre",
  sous_compromis: "Sous compromis",
  vendu: "Vendu",
  retire: "Retiré",
} as const;
export type PropertyStatus = keyof typeof PROPERTY_STATUSES;

export const OUTDOOR_TYPES = {
  aucun: "Aucun",
  balcon: "Balcon",
  terrasse: "Terrasse",
  jardin: "Jardin",
} as const;
export type OutdoorType = keyof typeof OUTDOOR_TYPES;

export const PARKING_TYPES = {
  aucun: "Aucun",
  place: "Place de parking",
  garage: "Garage / box",
} as const;
export type ParkingType = keyof typeof PARKING_TYPES;

export const PROPERTY_CONDITIONS = {
  neuf: "Neuf / récent",
  tres_bon: "Très bon état",
  bon: "Bon état",
  a_rafraichir: "À rafraîchir",
  travaux: "Travaux importants",
} as const;
export type PropertyCondition = keyof typeof PROPERTY_CONDITIONS;

export const MANDATE_TYPES = {
  simple: "Simple",
  exclusif: "Exclusif",
  semi_exclusif: "Semi-exclusif",
} as const;
export type MandateType = keyof typeof MANDATE_TYPES;

/** Classes énergie (DPE) et climat (GES). */
export const ENERGY_CLASSES = ["A", "B", "C", "D", "E", "F", "G"] as const;
export type EnergyClass = (typeof ENERGY_CLASSES)[number];

/** Nombre de jours avant l'échéance du mandat à partir duquel une alerte est affichée. */
export const MANDATE_ALERT_DAYS = 30;

/** Espace de stockage Supabase (privé) des photos des biens. */
export const PHOTOS_BUCKET = "property-photos";

/** Espace de stockage Supabase (privé) des logos d'agence. */
export const LOGOS_BUCKET = "agent-logos";
