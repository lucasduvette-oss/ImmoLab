import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

/** Le « proxy » Next.js s'exécute avant chaque requête : ici, il protège les pages privées. */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Toutes les routes sauf les fichiers statiques, les images, le manifeste et le service worker de la PWA.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
