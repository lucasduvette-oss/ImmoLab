"use client";

import { useState } from "react";
import { PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormMessage, SubmitButton, useFormAction } from "@/components/form-fields";
import { todayISO } from "@/lib/format";
import type { Task } from "@/lib/types";
import { saveTask } from "@/app/(app)/taches/actions";

export type LinkOption = { id: string; label: string };

/**
 * Fenêtre de création / modification d'une tâche.
 * Depuis une fiche contact ou bien, le lien est pré-rempli (defaultContactId / defaultPropertyId).
 */
export function TaskDialog({
  task,
  contacts,
  properties,
  defaultContactId,
  defaultPropertyId,
  trigger,
}: {
  task?: Task;
  contacts: LinkOption[];
  properties: LinkOption[];
  defaultContactId?: string;
  defaultPropertyId?: string;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [due, setDue] = useState("");
  const { state, onSubmit, pending, reset } = useFormAction(saveTask, { onSuccess: () => setOpen(false) });
  const e = state.fieldErrors ?? {};

  function onOpenChange(next: boolean) {
    if (next) {
      setDue(task?.due_date ?? todayISO());
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
            Nouvelle tâche
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{task ? "Modifier la tâche" : "Nouvelle tâche"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          {task && <input type="hidden" name="id" value={task.id} />}
          <FormMessage state={state} />
          <Field label="Intitulé *" htmlFor="title" error={e.title}>
            <Input id="title" name="title" defaultValue={task?.title ?? ""} required placeholder="ex. Rappeler pour fixer une visite" />
          </Field>
          <Field label="Échéance *" htmlFor="due_date" error={e.due_date}>
            <Input id="due_date" name="due_date" type="date" value={due} onChange={(ev) => setDue(ev.target.value)} required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Contact" htmlFor="contact_id" error={e.contact_id}>
              <NativeSelect id="contact_id" name="contact_id" defaultValue={task?.contact_id ?? defaultContactId ?? ""}>
                <option value="">— Aucun —</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Bien" htmlFor="property_id" error={e.property_id}>
              <NativeSelect id="property_id" name="property_id" defaultValue={task?.property_id ?? defaultPropertyId ?? ""}>
                <option value="">— Aucun —</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <Field label="Notes" htmlFor="notes" error={e.notes}>
            <Textarea id="notes" name="notes" rows={3} defaultValue={task?.notes ?? ""} />
          </Field>
          <SubmitButton pending={pending}>Enregistrer</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
