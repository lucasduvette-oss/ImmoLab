import { MANDATE_ALERT_DAYS, PROPERTY_TYPES } from "./constants";
import { daysBetween, formatNumber, formatSurface, todayISO } from "./format";
import type { Property } from "./types";

/** Titre court d'un bien : « Appartement 3 pièces · 68 m² · Nantes ». */
export function propertyTitle(p: Pick<Property, "type" | "rooms" | "surface" | "city">): string {
  const parts: string[] = [PROPERTY_TYPES[p.type]];
  if (p.rooms) parts[0] += ` ${formatNumber(p.rooms)} pièce${p.rooms > 1 ? "s" : ""}`;
  if (p.surface) parts.push(formatSurface(p.surface));
  if (p.city) parts.push(p.city);
  return parts.join(" · ");
}

/** Adresse complète d'un bien sur une ligne. */
export function propertyAddress(p: Pick<Property, "address" | "postal_code" | "city">): string {
  return [p.address, [p.postal_code, p.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
}

/** Statuts pour lesquels le mandat est « actif » (une échéance proche mérite une alerte). */
const ACTIVE_STATUSES = new Set(["estimation", "en_vente", "sous_offre"]);

/**
 * Alerte d'échéance du mandat : renvoie le nombre de jours restants si le mandat
 * expire dans les 30 jours (ou est déjà expiré), sinon null.
 */
export function mandateAlert(
  p: Pick<Property, "mandate_end" | "status">,
  today: string = todayISO(),
): { daysLeft: number; expired: boolean } | null {
  if (!p.mandate_end || !ACTIVE_STATUSES.has(p.status)) return null;
  const daysLeft = daysBetween(today, p.mandate_end);
  if (daysLeft > MANDATE_ALERT_DAYS) return null;
  return { daysLeft, expired: daysLeft < 0 };
}

/** Texte de l'alerte : « Mandat : échéance dans 12 jours », « Mandat expiré depuis 3 jours ». */
export function mandateAlertText(alert: { daysLeft: number; expired: boolean }): string {
  if (alert.expired) return `Mandat expiré depuis ${-alert.daysLeft} jour${alert.daysLeft < -1 ? "s" : ""}`;
  if (alert.daysLeft === 0) return "Mandat : échéance aujourd'hui";
  return `Mandat : échéance dans ${alert.daysLeft} jour${alert.daysLeft > 1 ? "s" : ""}`;
}
