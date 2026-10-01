"use client";

import { useState } from "react";
import { PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormMessage, SubmitButton, useFormAction } from "@/components/form-fields";
import { fullName, utcToParisLocal } from "@/lib/format";
import type { Contact, Visit } from "@/lib/types";
import { saveVisit } from "../actions";

type BuyerOption = Pick<Contact, "id" | "first_name" | "last_name">;

/** Fenêtre d'ajout / de modification d'une visite et de son retour (note + avis). */
export function VisitDialog({
  propertyId,
  buyers,
  visit,
  trigger,
}: {
  propertyId: string;
  buyers: BuyerOption[];
  visit?: Visit;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { state, onSubmit, pending, reset } = useFormAction(saveVisit, { onSuccess: () => setOpen(false) });
  const [when, setWhen] = useState("");
  const e = state.fieldErrors ?? {};

  function onOpenChange(next: boolean) {
    if (next) {
      setWhen(utcToParisLocal(visit?.visited_at ?? new Date().toISOString()));
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
            Ajouter une visite
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{visit ? "Visite et retour" : "Nouvelle visite"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <input type="hidden" name="property_id" value={propertyId} />
          {visit && <input type="hidden" name="id" value={visit.id} />}
          {visit?.feedback_sent_at && <input type="hidden" name="feedback_sent_at" value={visit.feedback_sent_at} />}
          <FormMessage state={state} />

          <Field label="Acquéreur *" htmlFor="buyer_contact_id" error={e.buyer_contact_id}>
            <NativeSelect id="buyer_contact_id" name="buyer_contact_id" defaultValue={visit?.buyer_contact_id ?? ""} required>
              <option value="">— Choisir —</option>
              {buyers.map((b) => (
                <option key={b.id} value={b.id}>
                  {fullName(b)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Date et heure *" htmlFor="visited_at" error={e.visited_at}>
            <Input id="visited_at" name="visited_at" type="datetime-local" value={when} onChange={(ev) => setWhen(ev.target.value)} required />
          </Field>

          <fieldset className="grid gap-3 rounded-lg border p-3">
            <legend className="px-1 text-sm font-medium">Retour de visite</legend>
            <Field label="Note de l'acquéreur" htmlFor="rating" error={e.rating}>
              <NativeSelect id="rating" name="rating" defaultValue={visit?.rating?.toString() ?? ""}>
                <option value="">— Pas encore de retour —</option>
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {"★".repeat(n)} ({n}/5)
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Avis" htmlFor="feedback" error={e.feedback}>
              <Textarea id="feedback" name="feedback" rows={3} defaultValue={visit?.feedback ?? ""} placeholder="Points positifs, objections, intention…" />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="feedback_sent" defaultChecked={Boolean(visit?.feedback_sent_at)} className="size-4 accent-[var(--primary)]" />
              Retour transmis au vendeur
            </label>
          </fieldset>

          <SubmitButton pending={pending}>Enregistrer</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
