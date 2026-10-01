import { NextResponse, type NextRequest } from "next/server";

import { searchAddresses } from "@/lib/geocoding";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/geocodage?q=12 rue Crébillon Nantes
 * Autocomplétion d'adresse pour les formulaires (réservée aux utilisateurs connectés).
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const q = request.nextUrl.searchParams.get("q") ?? "";
  const results = await searchAddresses(q, 5);
  return NextResponse.json({ results });
}
