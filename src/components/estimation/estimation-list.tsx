import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";

import { formatDate, formatEuros, formatNumber, formatSurface } from "@/lib/format";
import { propertyAddress } from "@/lib/property";
import type { EstimationListItem } from "@/lib/queries/estimations";

/** Historique des estimations : date, bien, prix conseillé et net vendeur. */
export function EstimationList({ estimations, showAddress = true }: { estimations: EstimationListItem[]; showAddress?: boolean }) {
  return (
    <ul className="divide-y">
      {estimations.map((e) => (
        <li key={e.id}>
          <Link href={`/estimations/${e.id}`} className="flex items-center gap-3 py-3 hover:bg-accent/40">
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {e.property_type === "maison" ? "Maison" : "Appartement"} · {formatSurface(e.surface)}
                {e.rooms ? ` · ${formatNumber(e.rooms)} p.` : ""}
              </p>
              {showAddress && <p className="truncate text-sm text-muted-foreground">{propertyAddress(e) || "Adresse non renseignée"}</p>}
              <p className="text-xs text-muted-foreground">
                Le {formatDate(e.created_at)} · {e.comparables_count} vente{e.comparables_count > 1 ? "s" : ""} retenue{e.comparables_count > 1 ? "s" : ""}
              </p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-primary">{formatEuros(e.recommended_price)}</p>
              <p className="text-xs text-muted-foreground">net {formatEuros(e.net_seller_price)}</p>
            </div>
            <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
