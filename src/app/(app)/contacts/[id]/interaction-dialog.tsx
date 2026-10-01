"use client";

import { useState } from "react";
import { PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormMessage, SubmitButton, useFormAction } from "@/components/form-fields";
import { INTERACTION_KINDS, toOptions, type InteractionKind } from "@/lib/constants";
import { utcToParisLocal } from "@/lib/format";
import type { Interaction } from "@/lib/types";
import { cn } from "@/lib/utils";
import { saveInteraction } from "../actions";
import { InteractionIcon } from "./interaction-icon";

/**
 * Fenêtre d'ajout / de modification d'un échange (appel, SMS, mail, rendez-vous, visite, note).
 * Pour planifier un rendez-vous, il suffit de choisir une date future.
 */
export function InteractionDialog({
  contactId,
  interaction,
  defaultKind = "appel",
  trigger,
}: {
  contactId: string;
  interaction?: Interaction;
  defaultKind?: InteractionKind;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  // Fermeture automatique après un enregistrement réussi.
  const { state, onSubmit, pending, reset } = useFormAction(saveInteraction, { onSuccess: () => setOpen(false) });
  const [kind, setKind] = useState<InteractionKind>(interaction?.kind ?? defaultKind);
  const [when, setWhen] = useState("");

  function onOpenChange(next: boolean) {
    if (next) {
      // La date par défaut (maintenant) est calculée à l'ouverture, côté navigateur.
      setWhen(utcToParisLocal(interaction?.occurred_at ?? new Date().toISOString()));
      setKind(interaction?.kind ?? defaultKind);
      reset();
    }
    setOpen(next);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <PlusIcon />
            Ajouter un échange
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{interaction ? "Modifier l'échange" : "Nouvel échange"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <input type="hidden" name="contact_id" value={contactId} />
          {interaction && <input type="hidden" name="id" value={interaction.id} />}
          <input type="hidden" name="kind" value={kind} />
          <FormMessage state={state} />

          <div className="grid grid-cols-3 gap-2">
            {toOptions(INTERACTION_KINDS).map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setKind(o.value)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-md border px-2 py-2 text-xs font-medium",
                  kind === o.value ? "border-primary bg-accent text-primary" : "bg-card text-muted-foreground",
                )}
              >
                <InteractionIcon kind={o.value} className="size-5" />
                {o.label}
              </button>
            ))}
          </div>

          <Field label="Date et heure" htmlFor="occurred_at" error={state.fieldErrors?.occurred_at}>
            <Input id="occurred_at" name="occurred_at" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} required />
          </Field>
          <Field label="Contenu" htmlFor="content" error={state.fieldErrors?.content}>
            <Textarea
              id="content"
              name="content"
              rows={4}
              defaultValue={interaction?.content ?? ""}
              placeholder={kind === "rdv" ? "Objet et lieu du rendez-vous" : "Résumé de l'échange"}
            />
          </Field>
          <SubmitButton pending={pending}>Enregistrer</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
