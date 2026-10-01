import type { Metadata } from "next";
import { CheckSquareIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/page-header";
import { SuggestionList } from "@/components/tasks/suggestion-list";
import { TaskDialog } from "@/components/tasks/task-dialog";
import { TaskList } from "@/components/tasks/task-list";
import { getLinkOptions } from "@/lib/queries/link-options";
import { listOpenTasks, listRecentDoneTasks, splitTasks } from "@/lib/queries/tasks";
import { getSuggestions } from "@/lib/suggestions";
import { requireUser } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Tâches" };

export default async function TasksPage() {
  const { supabase } = await requireUser();
  const [open, done, suggestions, links] = await Promise.all([
    listOpenTasks(supabase),
    listRecentDoneTasks(supabase),
    getSuggestions(supabase),
    getLinkOptions(supabase),
  ]);
  const { overdue, today, upcoming } = splitTasks(open);

  const sections = [
    { title: "En retard", tasks: overdue, danger: true },
    { title: "Aujourd'hui", tasks: today },
    { title: "À venir", tasks: upcoming },
  ].filter((s) => s.tasks.length > 0);

  return (
    <>
      <PageHeader
        title="Tâches"
        description={`${open.length} à faire`}
        actions={<TaskDialog contacts={links.contacts} properties={links.properties} />}
      />

      <div className="grid gap-4">
        {suggestions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Relances suggérées ({suggestions.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <SuggestionList suggestions={suggestions} />
            </CardContent>
          </Card>
        )}

        {sections.length === 0 && (
          <EmptyState icon={CheckSquareIcon} title="Aucune tâche à faire">
            Créez une tâche avec le bouton « Nouvelle tâche ».
          </EmptyState>
        )}

        {sections.map((s) => (
          <Card key={s.title}>
            <CardHeader>
              <CardTitle className={cn(s.danger && "text-destructive")}>
                {s.title} ({s.tasks.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TaskList tasks={s.tasks} contacts={links.contacts} properties={links.properties} />
            </CardContent>
          </Card>
        ))}

        {done.length > 0 && (
          <details className="rounded-xl border bg-card p-4">
            <summary className="cursor-pointer font-semibold">Terminées ces 30 derniers jours ({done.length})</summary>
            <div className="mt-4">
              <TaskList tasks={done} contacts={links.contacts} properties={links.properties} />
            </div>
          </details>
        )}
      </div>
    </>
  );
}
