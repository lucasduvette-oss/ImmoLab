import { MUST_HAVES, PROPERTY_TYPES, TIMEFRAMES } from "@/lib/constants";
import { formatEuros, formatSurface } from "@/lib/format";
import type { BuyerProfile } from "@/lib/types";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}

const yesNo = (v: boolean | null) => (v === null ? "—" : v ? "Oui" : "Non");

/** Résumé de la qualification et des critères de recherche d'un acquéreur. */
export function BuyerSummary({ profile }: { profile: BuyerProfile }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Qualification</h3>
        <dl className="divide-y">
          <Row label="Budget max">{formatEuros(profile.budget_max)}</Row>
          <Row label="Accord de principe">{yesNo(profile.financing_approved)}</Row>
          <Row label="Apport">{formatEuros(profile.down_payment)}</Row>
          <Row label="Délai">{profile.timeframe ? TIMEFRAMES[profile.timeframe] : "—"}</Row>
          <Row label="Vente préalable">{yesNo(profile.needs_prior_sale)}</Row>
          <Row label="Motivation">
            {profile.motivation ? (
              <span aria-label={`${profile.motivation} sur 5`}>
                {"★".repeat(profile.motivation)}
                <span className="text-muted-foreground/40">{"★".repeat(5 - profile.motivation)}</span>
              </span>
            ) : (
              "—"
            )}
          </Row>
        </dl>
      </div>
      <div>
        <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Recherche</h3>
        <dl className="divide-y">
          <Row label="Type de bien">
            {profile.property_types.length ? profile.property_types.map((t) => PROPERTY_TYPES[t]).join(", ") : "Indifférent"}
          </Row>
          <Row label="Secteur">{profile.locations.length ? profile.locations.join(", ") : "Indifférent"}</Row>
          <Row label="Surface min">{profile.min_surface ? formatSurface(profile.min_surface) : "—"}</Row>
          <Row label="Pièces min">{profile.min_rooms ?? "—"}</Row>
          <Row label="Indispensables">
            {profile.must_haves.length ? profile.must_haves.map((m) => MUST_HAVES[m].split(" (")[0]).join(", ") : "—"}
          </Row>
        </dl>
      </div>
    </div>
  );
}
