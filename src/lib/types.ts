import type {
  BuyerStage,
  ContactRole,
  ContactSource,
  InteractionKind,
  MustHave,
  PartnerType,
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
