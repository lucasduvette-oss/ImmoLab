"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { NativeSelect } from "@/components/ui/native-select";
import { PROPERTY_STATUSES, toOptions } from "@/lib/constants";
import { updatePropertyStatus } from "../actions";

/** Changement rapide du statut d'un bien depuis sa fiche. */
export function PropertyStatusSelect({ propertyId, value }: { propertyId: string; value: string }) {
  const [status, setStatus] = useState(value);
  const [pending, startTransition] = useTransition();

  return (
    <NativeSelect
      aria-label="Statut du bien"
      value={status}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value;
        const previous = status;
        setStatus(next);
        startTransition(async () => {
          const result = await updatePropertyStatus(propertyId, next);
          if ("error" in result) {
            setStatus(previous);
            toast.error(result.error);
          } else toast.success("Statut mis à jour.");
        });
      }}
    >
      {toOptions(PROPERTY_STATUSES).map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </NativeSelect>
  );
}
