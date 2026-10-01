"use client";

import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { CheckboxField, Field, FormMessage, SubmitButton, useFormAction } from "@/components/form-fields";
import { MUST_HAVES, PROPERTY_TYPES, TIMEFRAMES, toOptions } from "@/lib/constants";
import type { BuyerProfile } from "@/lib/types";
import { saveBuyerProfile } from "../../actions";

const yesNoValue = (v: boolean | null | undefined) => (v === true ? "oui" : v === false ? "non" : "");

/** Qualification et critères de recherche d'un acquéreur. */
export function BuyerForm({ contactId, profile }: { contactId: string; profile: BuyerProfile | null }) {
  const { state, onSubmit, pending } = useFormAction(saveBuyerProfile);
  const e = state.fieldErrors ?? {};

  return (
    <form onSubmit={onSubmit} className="grid gap-6">
      <input type="hidden" name="contact_id" value={contactId} />
      <FormMessage state={state} />

      <section className="grid gap-4">
        <h2 className="text-lg font-semibold">Qualification</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Budget maximum (€)" htmlFor="budget_max" error={e.budget_max}>
            <Input id="budget_max" name="budget_max" inputMode="numeric" defaultValue={profile?.budget_max ?? ""} placeholder="ex. 350000" />
          </Field>
          <Field label="Apport (€)" htmlFor="down_payment" error={e.down_payment}>
            <Input id="down_payment" name="down_payment" inputMode="numeric" defaultValue={profile?.down_payment ?? ""} />
          </Field>
          <Field label="Accord de principe de la banque" htmlFor="financing_approved" error={e.financing_approved}>
            <NativeSelect id="financing_approved" name="financing_approved" defaultValue={yesNoValue(profile?.financing_approved)}>
              <option value="">— Non renseigné —</option>
              <option value="oui">Oui</option>
              <option value="non">Non</option>
            </NativeSelect>
          </Field>
          <Field label="Vente préalable nécessaire" htmlFor="needs_prior_sale" error={e.needs_prior_sale}>
            <NativeSelect id="needs_prior_sale" name="needs_prior_sale" defaultValue={yesNoValue(profile?.needs_prior_sale)}>
              <option value="">— Non renseigné —</option>
              <option value="oui">Oui</option>
              <option value="non">Non</option>
            </NativeSelect>
          </Field>
          <Field label="Délai" htmlFor="timeframe" error={e.timeframe}>
            <NativeSelect id="timeframe" name="timeframe" defaultValue={profile?.timeframe ?? ""}>
              <option value="">— Non renseigné —</option>
              {toOptions(TIMEFRAMES).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Motivation (1 à 5)" htmlFor="motivation" error={e.motivation}>
            <NativeSelect id="motivation" name="motivation" defaultValue={profile?.motivation?.toString() ?? ""}>
              <option value="">— Non renseignée —</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {"★".repeat(n)} ({n})
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
      </section>

      <section className="grid gap-4">
        <h2 className="text-lg font-semibold">Critères de recherche</h2>
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-medium">Type de bien</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {toOptions(PROPERTY_TYPES).map((o) => (
              <CheckboxField
                key={o.value}
                name="property_types"
                value={o.value}
                label={o.label}
                defaultChecked={profile?.property_types.includes(o.value)}
              />
            ))}
          </div>
        </fieldset>
        <Field
          label="Villes ou codes postaux"
          htmlFor="locations"
          error={e.locations}
          hint="Séparés par des virgules, ex. : Nantes, 44300, Rezé"
        >
          <Textarea id="locations" name="locations" rows={2} defaultValue={profile?.locations.join(", ") ?? ""} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Surface min (m²)" htmlFor="min_surface" error={e.min_surface}>
            <Input id="min_surface" name="min_surface" inputMode="decimal" defaultValue={profile?.min_surface ?? ""} />
          </Field>
          <Field label="Pièces min" htmlFor="min_rooms" error={e.min_rooms}>
            <Input id="min_rooms" name="min_rooms" inputMode="numeric" defaultValue={profile?.min_rooms ?? ""} />
          </Field>
        </div>
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-medium">Critères indispensables</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {toOptions(MUST_HAVES).map((o) => (
              <CheckboxField
                key={o.value}
                name="must_haves"
                value={o.value}
                label={o.label}
                defaultChecked={profile?.must_haves.includes(o.value)}
              />
            ))}
          </div>
        </fieldset>
      </section>

      <SubmitButton pending={pending} size="lg" className="sm:w-fit">
        Enregistrer
      </SubmitButton>
    </form>
  );
}
