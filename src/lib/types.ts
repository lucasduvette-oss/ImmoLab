import type {
  BuyerStage,
  ContactRole,
  ContactSource,
  EnergyClass,
  InteractionKind,
  MandateType,
  MustHave,
  OutdoorType,
  ParkingType,
  PartnerType,
  PropertyCondition,
  PropertyStatus,
  PropertyType,
  SellerStage,
  Timeframe,
} from "./constants";

/**
 * Types TypeScript correspondant aux tables de la base (voir supabase/migrations).
 * Les noms de colonnes sont identiques à ceux de la base.
 */

export type Profile = {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  agency_name: string | null;
  agency_address: string | null;
  logo_path: string | null;
};

export type Contact = {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  source: ContactSource | null;
  notes: string | null;
  roles: ContactRole[];
  partner_type: PartnerType | null;
  seller_stage: SellerStage | null;
  buyer_stage: BuyerStage | null;
  created_at: string;
  updated_at: string;
};

export type BuyerProfile = {
  contact_id: string;
  user_id: string;
  budget_max: number | null;
  financing_approved: boolean | null;
  down_payment: number | null;
  timeframe: Timeframe | null;
  needs_prior_sale: boolean | null;
  motivation: number | null;
  property_types: PropertyType[];
  locations: string[];
  min_surface: number | null;
  min_rooms: number | null;
  must_haves: MustHave[];
};

export type Interaction = {
  id: string;
  user_id: string;
  contact_id: string;
  kind: InteractionKind;
  occurred_at: string;
  content: string | null;
};

export type Property = {
  id: string;
  user_id: string;
  seller_contact_id: string | null;
  type: PropertyType;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  citycode: string | null;
  latitude: number | null;
  longitude: number | null;
  surface: number | null;
  rooms: number | null;
  bedrooms: number | null;
  floor: number | null;
  has_elevator: boolean | null;
  outdoor: OutdoorType | null;
  parking: ParkingType | null;
  construction_year: number | null;
  dpe: EnergyClass | null;
  ges: EnergyClass | null;
  condition: PropertyCondition | null;
  price: number | null;
  charges_annual: number | null;
  property_tax: number | null;
  description: string | null;
  status: PropertyStatus;
  mandate_type: MandateType | null;
  mandate_start: string | null;
  mandate_end: string | null;
  mandate_fees: number | null;
  created_at: string;
  updated_at: string;
};

export type PropertyPhoto = {
  id: string;
  property_id: string;
  storage_path: string;
  position: number;
};

export type Visit = {
  id: string;
  user_id: string;
  property_id: string;
  buyer_contact_id: string;
  visited_at: string;
  rating: number | null;
  feedback: string | null;
  feedback_sent_at: string | null;
};
