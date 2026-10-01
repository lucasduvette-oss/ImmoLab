"use client";

import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import { Field, FormMessage, SubmitButton, useFormAction } from "@/components/form-fields";
import {
  ENERGY_CLASSES,
  MANDATE_TYPES,
  OUTDOOR_TYPES,
  PARKING_TYPES,
  PROPERTY_CONDITIONS,
  PROPERTY_STATUSES,
  PROPERTY_TYPES,
  toOptions,
} from "@/lib/constants";
import { fullName } from "@/lib/format";
import type { Contact, Property } from "@/lib/types";
import { saveProperty } from "./actions";

type SellerOption = Pick<Contact, "id" | "first_name" | "last_name">;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 rounded-xl border bg-card p-4">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Options({ labels, empty = "—" }: { labels: Record<string, string>; empty?: string }) {
  return (
    <>
      <option value="">{empty}</option>
      {Object.entries(labels).map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </>
  );
}

const yesNoValue = (v: boolean | null | undefined) => (v === true ? "oui" : v === false ? "non" : "");
const val = (v: number | string | null | undefined) => (v === null || v === undefined ? "" : String(v));

/** Formulaire de création / modification d'un bien et de son mandat. */
export function PropertyForm({
  property,
  sellers,
  defaultSellerId,
}: {
  property?: Property;
  sellers: SellerOption[];
  defaultSellerId?: string;
}) {
  const { state, onSubmit, pending } = useFormAction(saveProperty);
  const e = state.fieldErrors ?? {};

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      {property && <input type="hidden" name="id" value={property.id} />}
      <FormMessage state={state} />

      <Section title="Bien">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type de bien *" htmlFor="type" error={e.type}>
            <NativeSelect id="type" name="type" defaultValue={property?.type ?? "appartement"} required>
              {toOptions(PROPERTY_TYPES).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Statut" htmlFor="status" error={e.status}>
            <NativeSelect id="status" name="status" defaultValue={property?.status ?? "estimation"}>
              {toOptions(PROPERTY_STATUSES).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
        <Field label="Vendeur" htmlFor="seller_contact_id" error={e.seller_contact_id} hint="Seuls les contacts ayant le rôle « Vendeur » sont proposés.">
          <NativeSelect id="seller_contact_id" name="seller_contact_id" defaultValue={property?.seller_contact_id ?? defaultSellerId ?? ""}>
            <option value="">— Aucun —</option>
            {sellers.map((s) => (
              <option key={s.id} value={s.id}>
                {fullName(s)}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </Section>

      <Section title="Adresse">
        <AddressAutocomplete initial={property} errors={e} />
      </Section>

      <Section title="Caractéristiques">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Surface (m²)" htmlFor="surface" error={e.surface}>
            <Input id="surface" name="surface" inputMode="decimal" defaultValue={val(property?.surface)} />
          </Field>
          <Field label="Pièces" htmlFor="rooms" error={e.rooms}>
            <Input id="rooms" name="rooms" inputMode="numeric" defaultValue={val(property?.rooms)} />
          </Field>
          <Field label="Chambres" htmlFor="bedrooms" error={e.bedrooms}>
            <Input id="bedrooms" name="bedrooms" inputMode="numeric" defaultValue={val(property?.bedrooms)} />
          </Field>
          <Field label="Étage" htmlFor="floor" error={e.floor} hint="0 = rez-de-chaussée">
            <Input id="floor" name="floor" inputMode="numeric" defaultValue={val(property?.floor)} />
          </Field>
          <Field label="Ascenseur" htmlFor="has_elevator" error={e.has_elevator}>
            <NativeSelect id="has_elevator" name="has_elevator" defaultValue={yesNoValue(property?.has_elevator)}>
              <option value="">—</option>
              <option value="oui">Oui</option>
              <option value="non">Non</option>
            </NativeSelect>
          </Field>
          <Field label="Extérieur" htmlFor="outdoor" error={e.outdoor}>
            <NativeSelect id="outdoor" name="outdoor" defaultValue={property?.outdoor ?? ""}>
              <Options labels={OUTDOOR_TYPES} />
            </NativeSelect>
          </Field>
          <Field label="Parking" htmlFor="parking" error={e.parking}>
            <NativeSelect id="parking" name="parking" defaultValue={property?.parking ?? ""}>
              <Options labels={PARKING_TYPES} />
            </NativeSelect>
          </Field>
          <Field label="Année de construction" htmlFor="construction_year" error={e.construction_year}>
            <Input id="construction_year" name="construction_year" inputMode="numeric" maxLength={4} defaultValue={val(property?.construction_year)} />
          </Field>
          <Field label="DPE" htmlFor="dpe" error={e.dpe}>
            <NativeSelect id="dpe" name="dpe" defaultValue={property?.dpe ?? ""}>
              <Options labels={Object.fromEntries(ENERGY_CLASSES.map((c) => [c, c]))} />
            </NativeSelect>
          </Field>
          <Field label="GES" htmlFor="ges" error={e.ges}>
            <NativeSelect id="ges" name="ges" defaultValue={property?.ges ?? ""}>
              <Options labels={Object.fromEntries(ENERGY_CLASSES.map((c) => [c, c]))} />
            </NativeSelect>
          </Field>
          <Field label="État" htmlFor="condition" error={e.condition} className="col-span-2">
            <NativeSelect id="condition" name="condition" defaultValue={property?.condition ?? ""}>
              <Options labels={PROPERTY_CONDITIONS} />
            </NativeSelect>
          </Field>
        </div>
      </Section>

      <Section title="Prix et charges">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Prix (€)" htmlFor="price" error={e.price}>
            <Input id="price" name="price" inputMode="numeric" defaultValue={val(property?.price)} placeholder="ex. 295000" />
          </Field>
          <Field label="Charges de copropriété (€/an)" htmlFor="charges_annual" error={e.charges_annual}>
            <Input id="charges_annual" name="charges_annual" inputMode="numeric" defaultValue={val(property?.charges_annual)} />
          </Field>
          <Field label="Taxe foncière (€/an)" htmlFor="property_tax" error={e.property_tax}>
            <Input id="property_tax" name="property_tax" inputMode="numeric" defaultValue={val(property?.property_tax)} />
          </Field>
        </div>
        <Field label="Description" htmlFor="description" error={e.description}>
          <Textarea id="description" name="description" rows={5} defaultValue={property?.description ?? ""} />
        </Field>
      </Section>

      <Section title="Mandat">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type de mandat" htmlFor="mandate_type" error={e.mandate_type}>
            <NativeSelect id="mandate_type" name="mandate_type" defaultValue={property?.mandate_type ?? ""}>
              <Options labels={MANDATE_TYPES} empty="— Pas de mandat —" />
            </NativeSelect>
          </Field>
          <Field label="Honoraires TTC (€)" htmlFor="mandate_fees" error={e.mandate_fees}>
            <Input id="mandate_fees" name="mandate_fees" inputMode="numeric" defaultValue={val(property?.mandate_fees)} />
          </Field>
          <Field label="Date de début" htmlFor="mandate_start" error={e.mandate_start}>
            <Input id="mandate_start" name="mandate_start" type="date" defaultValue={property?.mandate_start ?? ""} />
          </Field>
          <Field label="Date de fin" htmlFor="mandate_end" error={e.mandate_end} hint="Une alerte s'affiche 30 jours avant.">
            <Input id="mandate_end" name="mandate_end" type="date" defaultValue={property?.mandate_end ?? ""} />
          </Field>
        </div>
      </Section>

      <SubmitButton pending={pending} size="lg" className="sm:w-fit">
        {property ? "Enregistrer les modifications" : "Créer le bien"}
      </SubmitButton>
    </form>
  );
}
