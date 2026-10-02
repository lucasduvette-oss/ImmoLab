"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { CheckIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { setTaskDone } from "@/app/(app)/taches/actions";

/** Case ronde pour cocher une tâche (mise à jour immédiate à l'écran). */
export function TaskCheckbox({ taskId, title, done }: { taskId: string; title: string; done: boolean }) {
  const [optimisticDone, setOptimisticDone] = useOptimistic(done);
  const [, startTransition] = useTransition();

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={optimisticDone}
      aria-label={`Tâche faite : ${title}`}
      onClick={() =>
        startTransition(async () => {
          setOptimisticDone(!optimisticDone);
          const result = await setTaskDone(taskId, !optimisticDone);
          if ("error" in result) toast.error(result.error);
          else if (!optimisticDone) toast.success("Tâche terminée.");
        })
      }
      // Zone tactile de 40 px autour d'un rond de 24 px.
      className="-m-2 flex size-10 shrink-0 items-center justify-center rounded-full focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <span
        className={cn(
          "flex size-6 items-center justify-center rounded-full border-2 transition-colors",
          optimisticDone ? "border-success bg-success text-white" : "border-muted-foreground hover:border-primary",
        )}
      >
        {optimisticDone && <CheckIcon className="size-4" />}
      </span>
    </button>
  );
}
