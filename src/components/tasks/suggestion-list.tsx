import Link from "next/link";
import { BellRingIcon, CalendarClockIcon, MessageSquareReplyIcon, PlusIcon, UserRoundSearchIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/action-button";
import type { Suggestion } from "@/lib/suggestions";
import { createTaskFromSuggestion } from "@/app/(app)/taches/actions";

const ICONS = {
  "relance-acquereur": UserRoundSearchIcon,
  mandat: CalendarClockIcon,
  "avis-visite": MessageSquareReplyIcon,
  "retour-vendeur": BellRingIcon,
} satisfies Record<Suggestion["kind"], React.ComponentType<{ className?: string }>>;

/** Relances suggérées : ouvrir la fiche concernée ou transformer la relance en tâche. */
export function SuggestionList({ suggestions }: { suggestions: Suggestion[] }) {
  return (
    <ul className="divide-y">
      {suggestions.map((s) => {
        const Icon = ICONS[s.kind];
        return (
          <li key={s.key} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <Link href={s.href} className="font-medium break-words hover:underline">
                {s.title}
              </Link>
              <p className="text-sm break-words text-muted-foreground">{s.description}</p>
            </div>
            <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
              <ActionButton
                size="sm"
                variant="outline"
                action={createTaskFromSuggestion.bind(null, {
                  key: s.key,
                  title: s.title,
                  notes: s.taskNotes,
                  contactId: s.contactId,
                  propertyId: s.propertyId,
                })}
                aria-label={`Créer une tâche : ${s.title}`}
                success="Tâche créée pour aujourd'hui."
              >
                <PlusIcon /> Tâche
              </ActionButton>
              <Button asChild size="sm" variant="ghost" className="hidden sm:inline-flex">
                <Link href={s.href}>Ouvrir</Link>
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
