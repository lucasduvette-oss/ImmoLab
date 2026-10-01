import { AlertTriangleIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { PROPERTY_STATUSES, type PropertyStatus } from "@/lib/constants";
import { mandateAlert, mandateAlertText } from "@/lib/property";
import type { Property } from "@/lib/types";

const STATUS_STYLES: Record<PropertyStatus, string> = {
  estimation: "bg-violet-100 text-violet-900",
  en_vente: "bg-sky-100 text-sky-900",
  sous_offre: "bg-amber-100 text-amber-900",
  sous_compromis: "bg-orange-100 text-orange-900",
  vendu: "bg-emerald-100 text-emerald-900",
  retire: "bg-zinc-200 text-zinc-700",
};

export function StatusBadge({ status }: { status: PropertyStatus }) {
  return (
    <Badge variant="secondary" className={STATUS_STYLES[status]}>
      {PROPERTY_STATUSES[status]}
    </Badge>
  );
}

/** Pastille d'alerte quand le mandat arrive à échéance dans moins de 30 jours. */
export function MandateAlertBadge({ property }: { property: Pick<Property, "mandate_end" | "status"> }) {
  const alert = mandateAlert(property);
  if (!alert) return null;
  return (
    <Badge variant={alert.expired ? "destructive" : "warning"}>
      <AlertTriangleIcon />
      {mandateAlertText(alert)}
    </Badge>
  );
}
