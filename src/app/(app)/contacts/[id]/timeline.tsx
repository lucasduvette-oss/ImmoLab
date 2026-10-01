import { HistoryIcon, PencilIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/confirm-button";
import { INTERACTION_KINDS } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import type { Interaction } from "@/lib/types";
import { cn } from "@/lib/utils";
import { deleteInteraction } from "../actions";
import { InteractionDialog } from "./interaction-dialog";
import { InteractionIcon } from "./interaction-icon";

/** Élément affiché dans la timeline (un échange, ou une visite à partir de l'étape 3). */
export type TimelineItem = { type: "interaction"; date: string; interaction: Interaction };

/** Timeline des échanges, du plus récent au plus ancien. Les rendez-vous à venir sont mis en avant. */
export function Timeline({ contactId, items }: { contactId: string; items: TimelineItem[] }) {
  if (items.length === 0) {
    return (
      <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <HistoryIcon className="size-4" /> Aucun échange pour l&apos;instant.
      </p>
    );
  }
  const now = new Date().toISOString();

  return (
    <ol className="relative grid gap-4 border-l pl-5">
      {items.map((item) => {
        const it = item.interaction;
        const upcoming = it.occurred_at > now;
        return (
          <li key={it.id} className="relative">
            <span
              className={cn(
                "absolute top-0.5 -left-[33px] flex size-7 items-center justify-center rounded-full border bg-card text-muted-foreground",
                upcoming && "border-primary text-primary",
              )}
            >
              <InteractionIcon kind={it.kind} className="size-3.5" />
            </span>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {INTERACTION_KINDS[it.kind]}
                  {upcoming && <span className="ml-2 text-xs font-semibold text-primary">À venir</span>}
                </p>
                <p className="text-xs text-muted-foreground">{formatDateTime(it.occurred_at)}</p>
              </div>
              <div className="flex shrink-0">
                <InteractionDialog
                  contactId={contactId}
                  interaction={it}
                  trigger={
                    <Button variant="ghost" size="icon-sm" aria-label="Modifier l'échange">
                      <PencilIcon />
                    </Button>
                  }
                />
                <ConfirmButton action={deleteInteraction.bind(null, it.id)} title="Supprimer cet échange ?">
                  <Button variant="ghost" size="icon-sm" aria-label="Supprimer l'échange">
                    <Trash2Icon />
                  </Button>
                </ConfirmButton>
              </div>
            </div>
            {it.content && <p className="mt-1 text-sm whitespace-pre-line">{it.content}</p>}
          </li>
        );
      })}
    </ol>
  );
}
