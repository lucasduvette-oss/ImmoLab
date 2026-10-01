"use client";

import { NativeSelect } from "@/components/ui/native-select";
import { FilterChips, SearchInput } from "@/components/list-filters";
import { useUrlFilters } from "@/components/use-url-filters";
import { PROPERTY_STATUSES, PROPERTY_TYPES, toOptions } from "@/lib/constants";

/** Recherche et filtres de la liste des biens (statut, type, mandats à échéance). */
export function PropertyFilters() {
  const { get, update, q, setQ, pending } = useUrlFilters();

  return (
    <div className="mb-4 grid gap-3">
      <SearchInput value={q} onChange={setQ} pending={pending} placeholder="Adresse, ville, code postal…" label="Rechercher un bien" />
      <FilterChips
        options={[{ value: "", label: "Tous" }, ...toOptions(PROPERTY_STATUSES)]}
        value={get("statut")}
        onChange={(v) => update({ statut: v })}
      />
      <div className="grid grid-cols-2 gap-2">
        <NativeSelect value={get("type")} onChange={(e) => update({ type: e.target.value })} aria-label="Filtrer par type">
          <option value="">Tous types</option>
          {toOptions(PROPERTY_TYPES).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect value={get("mandat")} onChange={(e) => update({ mandat: e.target.value })} aria-label="Filtrer par mandat">
          <option value="">Tous mandats</option>
          <option value="echeance">Échéance &lt; 30 jours</option>
        </NativeSelect>
      </div>
    </div>
  );
}
