"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { CheckIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { setTaskDone } from "@/app/(app)/taches/actions";

/** Case ronde pour cocher une tâche (mise à jour immédiate à l'écran). */
export function TaskCheckbox({ taskId, done }: { taskId: string; done: boolean }) {
  const [optimisticDone, setOptimisticDone] = useOptimistic(done);
  const [, startTransition] = useTransition();

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={optimisticDone}
      aria-label={optimisticDone ? "Marquer comme à faire" : "Marquer comme faite"}
      onClick={() =>
        startTransition(async () => {
          setOptimisticDone(!optimisticDone);
          const result = await setTaskDone(taskId, !optimisticDone);
          if ("error" in result) toast.error(result.error);
          else if (!optimisticDone) toast.success("Tâche terminée.");
        })
      }
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
        optimisticDone ? "border-success bg-success text-white" : "border-muted-foreground/40 hover:border-primary",
      )}
    >
      {optimisticDone && <CheckIcon className="size-4" />}
    </button>
  );
}
