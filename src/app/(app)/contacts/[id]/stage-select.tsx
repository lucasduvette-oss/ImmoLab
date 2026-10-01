"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { NativeSelect } from "@/components/ui/native-select";
import { BUYER_STAGES, SELLER_STAGES, toOptions } from "@/lib/constants";
import { updateContactStage } from "../actions";

/** Menu permettant de changer l'étape d'un contact dans un pipeline, depuis sa fiche. */
export function StageSelect({
  contactId,
  pipeline,
  value,
}: {
  contactId: string;
  pipeline: "vendeur" | "acquereur";
  value: string;
}) {
  const [stage, setStage] = useState(value);
  const [pending, startTransition] = useTransition();
  const options = toOptions(pipeline === "vendeur" ? SELLER_STAGES : BUYER_STAGES);

  return (
    <label className="grid gap-1 text-sm">
      <span className="text-muted-foreground">{pipeline === "vendeur" ? "Pipeline vendeur" : "Pipeline acquéreur"}</span>
      <NativeSelect
        value={stage}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          const previous = stage;
          setStage(next);
          startTransition(async () => {
            const result = await updateContactStage(contactId, pipeline, next);
            if ("error" in result) {
              setStage(previous);
              toast.error(result.error);
            } else toast.success("Étape mise à jour.");
          });
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </NativeSelect>
    </label>
  );
}
