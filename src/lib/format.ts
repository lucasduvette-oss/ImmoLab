/**
 * Fonctions de mise en forme « à la française » : euros, dates, téléphones, surfaces.
 * Le fuseau horaire est fixé sur Paris pour que l'affichage soit identique sur le serveur
 * (Vercel tourne en heure UTC) et sur le téléphone.
 */

export const TIME_ZONE = "Europe/Paris";

const euroFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

/** 350000 → « 350 000 € » */
export function formatEuros(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return euroFormatter.format(value);
}

/** 4235.4 → « 4 235 €/m² » */
export function formatEurosPerSqm(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${euroFormatter.format(Math.round(value))}/m²`;
}

/** 72.5 → « 72,5 m² » */
export function formatSurface(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${numberFormatter.format(value)} m²`;
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return numberFormatter.format(value);
}

/** -5 → « −5 % », 3 → « +3 % » */
export function formatPercent(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${numberFormatter.format(Math.abs(value))} %`;
}

function toDate(value: string | Date): Date {
  // Une date seule « 2026-10-05 » est interprétée à midi pour éviter les décalages de fuseau.
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T12:00:00`);
  return typeof value === "string" ? new Date(value) : value;
}

/** « 05/10/2026 » */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", { timeZone: TIME_ZONE, dateStyle: "short" }).format(toDate(value));
}

/** « lundi 5 octobre 2026 » */
export function formatLongDate(value: string | Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(toDate(value));
}

/** « 05/10/2026 à 14:30 » */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = toDate(value);
  const date = new Intl.DateTimeFormat("fr-FR", { timeZone: TIME_ZONE, dateStyle: "short" }).format(d);
  const time = new Intl.DateTimeFormat("fr-FR", { timeZone: TIME_ZONE, timeStyle: "short" }).format(d);
  return `${date} à ${time}`;
}

/** « 14:30 » */
export function formatTime(value: string | Date): string {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: TIME_ZONE, timeStyle: "short" }).format(toDate(value));
}

/** « 0612345678 » → « 06 12 34 56 78 » (les numéros étrangers sont laissés tels quels). */
export function formatPhone(value: string | null | undefined): string {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10 && digits.startsWith("0")) return digits.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
  return value;
}

/** Numéro utilisable dans un lien tel: ou sms: (sans espaces). */
export function phoneHref(value: string): string {
  return value.replace(/[^\d+]/g, "");
}

/** Date du jour à Paris au format AAAA-MM-JJ (utilisée pour les échéances). */
export function todayISO(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(now);
}

/** Ajoute (ou retire) des jours à une date AAAA-MM-JJ. */
export function addDaysISO(dateISO: string, days: number): string {
  const d = new Date(`${dateISO}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Nombre de jours entre deux dates AAAA-MM-JJ (b − a). */
export function daysBetween(aISO: string, bISO: string): number {
  const a = new Date(`${aISO}T12:00:00Z`).getTime();
  const b = new Date(`${bISO}T12:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

/**
 * Début et fin de la journée en cours à Paris, au format ISO (UTC),
 * pour filtrer les rendez-vous et visites « du jour ».
 */
export function parisDayRange(dateISO: string = todayISO()): { start: string; end: string } {
  return { start: parisLocalToUTC(`${dateISO}T00:00`), end: parisLocalToUTC(`${addDaysISO(dateISO, 1)}T00:00`) };
}

/**
 * Convertit une heure « locale Paris » (AAAA-MM-JJTHH:MM, valeur d'un champ datetime-local)
 * en instant ISO UTC. Gère automatiquement l'heure d'été / d'hiver.
 */
export function parisLocalToUTC(local: string): string {
  const asUTC = new Date(`${local}:00Z`);
  const offsetMinutes = parisOffsetMinutes(asUTC);
  return new Date(asUTC.getTime() - offsetMinutes * 60_000).toISOString();
}

/** Inverse de parisLocalToUTC : instant ISO → « AAAA-MM-JJTHH:MM » à l'heure de Paris (pour pré-remplir un champ). */
export function utcToParisLocal(iso: string): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

function parisOffsetMinutes(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, timeZoneName: "longOffset" }).formatToParts(date);
  const tz = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+01:00";
  const match = tz.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

/** « Jean Dupont » à partir du prénom et du nom. */
export function fullName(c: { first_name?: string | null; last_name: string }): string {
  return [c.first_name, c.last_name].filter(Boolean).join(" ");
}

/** Lit un nombre saisi en français (« 72,5 », « 350 000 », « -5 ») ; texte vide ou invalide → null. */
export function parseFrenchNumber(value: string): number | null {
  const cleaned = value.replace(/[\s\u00a0\u202f€%]/g, "").replace(",", ".").replace("−", "-");
  if (cleaned === "" || cleaned === "-") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}
