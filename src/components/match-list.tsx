import Link from "next/link";
import { CheckIcon, CircleHelpIcon, XIcon } from "lucide-react";

import { ActionButton } from "@/components/action-button";
import { ContactActions } from "@/components/contact-actions";
import { formatEuros, fullName } from "@/lib/format";
import { matchDetailLabel, scoreTone } from "@/lib/matching";
import { propertyTitle } from "@/lib/property";
import type { MatchRow } from "@/lib/queries/matches";
import { cn } from "@/lib/utils";
import { markMatchesSeen } from "@/app/(app)/correspondances/actions";

/** Pastille du score de correspondance (sur 100). */
export function ScoreBadge({ score }: { score: number }) {
  const tone = scoreTone(score);
  return (
    <span
      className={cn(
        "flex size-12 shrink-0 flex-col items-center justify-center rounded-full text-sm leading-none font-bold",
        tone === "high" && "bg-success/15 text-success",
        tone === "medium" && "bg-warning/25 text-amber-800",
        tone === "low" && "bg-muted text-muted-foreground",
      )}
      aria-label={`Score ${score} sur 100`}
    >
      {score}
      <span className="text-[9px] font-medium">/100</span>
    </span>
  );
}

/** Liste des critères : ✓ respecté, ✗ non respecté, ? non renseigné. */
function Details({ match }: { match: MatchRow }) {
  return (
    <ul className="mt-1 flex flex-wrap gap-1">
      {match.details.map((d) => (
        <li
          key={d.key}
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs",
            d.ok === true && "bg-success/10 text-success",
            d.ok === false && "bg-destructive/10 text-destructive",
            d.ok === null && "bg-muted text-muted-foreground",
          )}
        >
          {d.ok === true ? <CheckIcon className="size-3" /> : d.ok === false ? <XIcon className="size-3" /> : <CircleHelpIcon className="size-3" />}
          {matchDetailLabel(d)}
        </li>
      ))}
    </ul>
  );
}

function NewBadge() {
  return <span className="rounded-md bg-destructive px-1.5 py-0.5 text-[10px] font-semibold text-white uppercase">Nouveau</span>;
}

/**
 * Liste de correspondances.
 * - show="buyer" : sur la fiche d'un bien, on affiche les acquéreurs ;
 * - show="property" : sur la fiche d'un acquéreur, on affiche les biens ;
 * - show="both" : page Correspondances.
 */
export function MatchList({ matches, show }: { matches: MatchRow[]; show: "buyer" | "property" | "both" }) {
  return (
    <ul className="divide-y">
      {matches.map((m) => (
        <li key={m.id} className={cn("flex gap-3 py-3 first:pt-0", !m.seen_at && show === "both" && "rounded-lg bg-accent/50 px-2 first:pt-3")}>
          <ScoreBadge score={m.score} />
          <div className="min-w-0 flex-1">
            {(show === "property" || show === "both") && (
              <p className="flex flex-wrap items-center gap-2 font-medium">
                <Link href={`/biens/${m.property.id}`} className="hover:underline">
                  {propertyTitle(m.property)}
                </Link>
                <span className="text-sm font-semibold text-primary">{formatEuros(m.property.price)}</span>
                {!m.seen_at && <NewBadge />}
              </p>
            )}
            {(show === "buyer" || show === "both") && (
              <p className={cn("flex items-center gap-2", show === "both" ? "text-sm text-muted-foreground" : "font-medium")}>
                {show === "both" && "Acquéreur : "}
                <Link href={`/contacts/${m.buyer.id}`} className="hover:underline">
                  {fullName(m.buyer)}
                </Link>
                {show === "buyer" && !m.seen_at && <NewBadge />}
              </p>
            )}
            <Details match={m} />
          </div>
          {show !== "property" && <ContactActions phone={m.buyer.phone} compact className="hidden shrink-0 sm:flex" />}
          {!m.seen_at && (
            <ActionButton
              variant="ghost"
              size="icon-sm"
              aria-label="Marquer comme vue"
              title="Marquer comme vue"
              action={markMatchesSeen.bind(null, [m.id])}
              className="shrink-0"
            >
              <CheckIcon />
            </ActionButton>
          )}
        </li>
      ))}
    </ul>
  );
}
