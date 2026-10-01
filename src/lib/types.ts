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
