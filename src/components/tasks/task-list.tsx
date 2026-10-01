import Link from "next/link";
import { BuildingIcon, PencilIcon, Trash2Icon, UserIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/confirm-button";
import { formatDate, fullName, todayISO } from "@/lib/format";
import { propertyTitle } from "@/lib/property";
import type { TaskWithLinks } from "@/lib/queries/tasks";
import { cn } from "@/lib/utils";
import { deleteTask } from "@/app/(app)/taches/actions";
import { TaskCheckbox } from "./task-checkbox";
import { TaskDialog, type LinkOption } from "./task-dialog";

/** Liste de tâches avec case à cocher, liens vers le contact / bien, modification et suppression. */
export function TaskList({
  tasks,
  contacts,
  properties,
  showLinks = true,
}: {
  tasks: TaskWithLinks[];
  contacts: LinkOption[];
  properties: LinkOption[];
  showLinks?: boolean;
}) {
  const today = todayISO();
  return (
    <ul className="divide-y">
      {tasks.map((t) => {
        const overdue = !t.done_at && t.due_date < today;
        return (
          <li key={t.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
            <TaskCheckbox taskId={t.id} done={Boolean(t.done_at)} />
            <div className="min-w-0 flex-1">
              <p className={cn("font-medium", t.done_at && "text-muted-foreground line-through")}>{t.title}</p>
              <p className={cn("text-xs text-muted-foreground", overdue && "font-semibold text-destructive")}>
                {t.done_at ? `Faite le ${formatDate(t.done_at)}` : `Échéance : ${t.due_date === today ? "aujourd'hui" : formatDate(t.due_date)}`}
              </p>
              {showLinks && (t.contact || t.property) && (
                <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                  {t.contact && (
                    <Link href={`/contacts/${t.contact.id}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                      <UserIcon className="size-3" /> {fullName(t.contact)}
                    </Link>
                  )}
                  {t.property && (
                    <Link href={`/biens/${t.property.id}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                      <BuildingIcon className="size-3" /> {propertyTitle(t.property)}
                    </Link>
                  )}
                </p>
              )}
              {t.notes && <p className="mt-1 text-sm whitespace-pre-line text-muted-foreground">{t.notes}</p>}
            </div>
            <div className="flex shrink-0">
              <TaskDialog
                task={t}
                contacts={contacts}
                properties={properties}
                trigger={
                  <Button variant="ghost" size="icon-sm" aria-label="Modifier la tâche">
                    <PencilIcon />
                  </Button>
                }
              />
              <ConfirmButton action={deleteTask.bind(null, t.id)} title="Supprimer cette tâche ?">
                <Button variant="ghost" size="icon-sm" aria-label="Supprimer la tâche">
                  <Trash2Icon />
                </Button>
              </ConfirmButton>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
