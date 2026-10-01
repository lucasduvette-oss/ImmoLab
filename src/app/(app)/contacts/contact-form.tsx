"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormMessage, SubmitButton, useFormAction } from "@/components/form-fields";
import { CONTACT_ROLES, CONTACT_SOURCES, PARTNER_TYPES, toOptions } from "@/lib/constants";
import type { Contact } from "@/lib/types";
import { saveContact } from "./actions";

/** Formulaire de création / modification d'un contact. */
export function ContactForm({ contact }: { contact?: Contact }) {
  const { state, onSubmit, pending } = useFormAction(saveContact);
  const e = state.fieldErrors ?? {};
  const [isPartner, setIsPartner] = useState(contact?.roles.includes("partenaire") ?? false);

  return (
    <form onSubmit={onSubmit} className="grid gap-5">
      {contact && <input type="hidden" name="id" value={contact.id} />}
      <FormMessage state={state} />

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">Rôles</legend>
        <div className="grid grid-cols-2 gap-2">
          {toOptions(CONTACT_ROLES).map((o) => (
            <label
              key={o.value}
              className="flex min-h-10 cursor-pointer items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-accent"
            >
              <input
                type="checkbox"
                name="roles"
                value={o.value}
                defaultChecked={contact?.roles.includes(o.value)}
                onChange={o.value === "partenaire" ? (ev) => setIsPartner(ev.target.checked) : undefined}
                className="size-4 accent-[var(--primary)]"
              />
              {o.label}
            </label>
          ))}
        </div>
        {isPartner && (
          <Field label="Type de partenaire" htmlFor="partner_type" error={e.partner_type} className="mt-2">
            <NativeSelect id="partner_type" name="partner_type" defaultValue={contact?.partner_type ?? ""}>
              <option value="">— Choisir —</option>
              {toOptions(PARTNER_TYPES).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
        )}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Prénom" htmlFor="first_name" error={e.first_name}>
          <Input id="first_name" name="first_name" defaultValue={contact?.first_name ?? ""} autoComplete="off" />
        </Field>
        <Field label="Nom *" htmlFor="last_name" error={e.last_name}>
          <Input id="last_name" name="last_name" defaultValue={contact?.last_name ?? ""} required autoComplete="off" />
        </Field>
        <Field label="Téléphone" htmlFor="phone" error={e.phone}>
          <Input id="phone" name="phone" type="tel" inputMode="tel" defaultValue={contact?.phone ?? ""} />
        </Field>
        <Field label="Email" htmlFor="email" error={e.email}>
          <Input id="email" name="email" type="email" inputMode="email" defaultValue={contact?.email ?? ""} />
        </Field>
      </div>

      <Field label="Adresse" htmlFor="address" error={e.address}>
        <Input id="address" name="address" defaultValue={contact?.address ?? ""} />
      </Field>
      <div className="grid grid-cols-[8rem_1fr] gap-4">
        <Field label="Code postal" htmlFor="postal_code" error={e.postal_code}>
          <Input id="postal_code" name="postal_code" inputMode="numeric" maxLength={5} defaultValue={contact?.postal_code ?? ""} />
        </Field>
        <Field label="Ville" htmlFor="city" error={e.city}>
          <Input id="city" name="city" defaultValue={contact?.city ?? ""} />
        </Field>
      </div>

      <Field label="Source" htmlFor="source" error={e.source}>
        <NativeSelect id="source" name="source" defaultValue={contact?.source ?? ""}>
          <option value="">— Non renseignée —</option>
          {toOptions(CONTACT_SOURCES).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </NativeSelect>
      </Field>

      <Field label="Notes" htmlFor="notes" error={e.notes}>
        <Textarea id="notes" name="notes" rows={4} defaultValue={contact?.notes ?? ""} />
      </Field>

      <SubmitButton pending={pending} size="lg" className="sm:w-fit">
        {contact ? "Enregistrer les modifications" : "Créer le contact"}
      </SubmitButton>
    </form>
  );
}
