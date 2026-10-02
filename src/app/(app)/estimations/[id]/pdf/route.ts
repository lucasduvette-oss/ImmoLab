import { NextResponse, type NextRequest } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";

import { LOGOS_BUCKET, PHOTOS_BUCKET } from "@/lib/constants";
import { todayISO } from "@/lib/format";
import { EstimationReport, type ReportData } from "@/lib/pdf/estimation-report";
import { isUsableImage } from "@/lib/pdf/image-size";
import { getEstimation } from "@/lib/queries/estimations";
import { buildStaticMap } from "@/lib/static-map";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Property } from "@/lib/types";

// Le rendu du PDF (carte comprise) prend quelques secondes ; marge de sécurité pour l'hébergeur.
export const maxDuration = 60;

/**
 * Télécharge une image du stockage privé. Le PDF n'accepte que PNG et JPEG de taille raisonnable :
 * le format et les dimensions sont vérifiés d'après le contenu du fichier (sinon l'image est ignorée).
 */
async function storageImage(supabase: Awaited<ReturnType<typeof createClient>>, bucket: string, path: string | null) {
  if (!path) return null;
  const { data } = await supabase.storage.from(bucket).download(path);
  if (!data) return null;
  const buffer = Buffer.from(await data.arrayBuffer());
  return isUsableImage(buffer) ? buffer : null;
}

/** « Saint-Étienne » → « saint-etienne » (nom de fichier sans accents ni espaces). */
function slug(value: string | null) {
  const s = (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "bien";
}

/**
 * GET /estimations/<id>/pdf : rapport d'estimation au format PDF.
 * Réservé à l'agent propriétaire de l'estimation (les règles RLS de la base s'appliquent).
 */
export async function GET(_request: NextRequest, ctx: RouteContext<"/estimations/[id]/pdf">) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const estimation = await getEstimation(supabase, id);
  if (!estimation) return NextResponse.json({ error: "Estimation introuvable" }, { status: 404 });

  const [{ data: profile }, { data: property }, { data: photo }] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle<Profile>(),
    estimation.property_id
      ? supabase.from("properties").select("*").eq("id", estimation.property_id).maybeSingle<Property>()
      : Promise.resolve({ data: null }),
    estimation.property_id
      ? supabase
          .from("property_photos")
          .select("storage_path")
          .eq("property_id", estimation.property_id)
          .order("position")
          .order("created_at")
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const [logo, photoImage, map] = await Promise.all([
    storageImage(supabase, LOGOS_BUCKET, profile?.logo_path ?? null),
    storageImage(supabase, PHOTOS_BUCKET, photo?.storage_path ?? null),
    buildStaticMap({
      center: { latitude: estimation.latitude, longitude: estimation.longitude },
      radiusM: estimation.radius_m,
      points: estimation.comparables.map((c) => ({
        latitude: c.latitude,
        longitude: c.longitude,
        kind: c.excluded ? ("excluded" as const) : ("comparable" as const),
      })),
    }).catch(() => null),
  ]);

  const data: ReportData = {
    estimation,
    profile: profile ?? null,
    logo,
    property: property ?? null,
    photo: photoImage,
    // Sans aucune tuile (service de cartes injoignable), la carte est omise.
    map: map && map.tiles.length > 0 ? map : null,
    generatedAt: new Date(),
  };

  let pdf: Buffer;
  try {
    pdf = await renderToBuffer(createElement(EstimationReport, { data }) as Parameters<typeof renderToBuffer>[0]);
  } catch (e) {
    console.error("Rapport PDF :", e);
    return new NextResponse("Le rapport PDF n'a pas pu être généré. Réessayez dans quelques instants.", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, no-store" },
    });
  }
  // Date du jour de l'estimation, à l'heure de Paris (comme dans le rapport).
  const day = todayISO(new Date(estimation.updated_at ?? estimation.created_at));
  const filename = `avis-de-valeur-${slug(estimation.city)}-${day}.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
