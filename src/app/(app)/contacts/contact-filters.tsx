"use client";

import { NativeSelect } from "@/components/ui/native-select";
import { BUYER_STAGES, CONTACT_ROLES, CONTACT_SOURCES, SELLER_STAGES, toOptions } from "@/lib/constants";
import { FilterChips, SearchInput } from "@/components/list-filters";
import { useUrlFilters } from "@/components/use-url-filters";

/**
 * Barre de recherche et filtres de la liste des contacts.
 * Les filtres sont placés dans l'adresse de la page (?q=…&role=…) : on peut donc
 * revenir en arrière ou garder un favori d'une recherche.
 */
export function ContactFilters() {
  const { get, update, q, setQ, pending } = useUrlFilters();
  const role = get("role");
  const source = get("source");
  const stage = get("stage");

  const stageOptions = role === "vendeur" ? toOptions(SELLER_STAGES) : role === "acquereur" ? toOptions(BUYER_STAGES) : [];

  return (
    <div className="mb-4 grid gap-3">
      <SearchInput value={q} onChange={setQ} pending={pending} placeholder="Nom, téléphone, email, ville…" label="Rechercher un contact" />
      <FilterChips
        options={[{ value: "", label: "Tous" }, ...toOptions(CONTACT_ROLES).map((o) => ({ value: o.value, label: `${o.label}s` }))]}
        value={role}
        onChange={(v) => update({ role: v, stage: "" })}
      />

      <div className="grid grid-cols-2 gap-2">
        <NativeSelect value={source} onChange={(e) => update({ source: e.target.value })} aria-label="Filtrer par source">
          <option value="">Toutes sources</option>
          {toOptions(CONTACT_SOURCES).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          value={stage}
          onChange={(e) => update({ stage: e.target.value })}
          disabled={stageOptions.length === 0}
          aria-label="Filtrer par étape"
        >
          <option value="">{stageOptions.length ? "Toutes étapes" : "Étape"}</option>
          {stageOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </NativeSelect>
      </div>
    </div>
  );
}
