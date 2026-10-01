"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormMessage, SubmitButton, useFormAction } from "@/components/form-fields";
import type { Profile } from "@/lib/types";
import { saveProfile } from "./actions";

export function ProfileForm({ profile }: { profile: Profile | null }) {
  const { state, onSubmit, pending } = useFormAction(saveProfile);
  const e = state.fieldErrors ?? {};
  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Prénom et nom" htmlFor="full_name" error={e.full_name}>
          <Input id="full_name" name="full_name" defaultValue={profile?.full_name ?? ""} autoComplete="name" />
        </Field>
        <Field label="Téléphone" htmlFor="phone" error={e.phone}>
          <Input id="phone" name="phone" type="tel" defaultValue={profile?.phone ?? ""} autoComplete="tel" />
        </Field>
        <Field label="Email professionnel" htmlFor="email" error={e.email}>
          <Input id="email" name="email" type="email" defaultValue={profile?.email ?? ""} />
        </Field>
        <Field label="Nom de l'agence" htmlFor="agency_name" error={e.agency_name}>
          <Input id="agency_name" name="agency_name" defaultValue={profile?.agency_name ?? ""} />
        </Field>
      </div>
      <Field label="Adresse de l'agence" htmlFor="agency_address" error={e.agency_address}>
        <Textarea id="agency_address" name="agency_address" rows={2} defaultValue={profile?.agency_address ?? ""} />
      </Field>
      <SubmitButton pending={pending} className="sm:w-fit">Enregistrer le profil</SubmitButton>
    </form>
  );
}
