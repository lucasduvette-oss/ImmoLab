"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2Icon, SearchIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { BUYER_STAGES, CONTACT_ROLES, CONTACT_SOURCES, SELLER_STAGES, toOptions } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * Barre de recherche et filtres de la liste des contacts.
 * Les filtres sont placés dans l'adresse de la page (?q=…&role=…) : on peut donc
 * revenir en arrière ou garder un favori d'une recherche.
 */
export function ContactFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");

  const role = params.get("role") ?? "";
  const source = params.get("source") ?? "";
  const stage = params.get("stage") ?? "";

  function update(changes: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  // Recherche lancée automatiquement 300 ms après la dernière frappe.
  useEffect(() => {
    if (q === (params.get("q") ?? "")) return;
    const timer = setTimeout(() => update({ q }), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const stageOptions = role === "vendeur" ? toOptions(SELLER_STAGES) : role === "acquereur" ? toOptions(BUYER_STAGES) : [];

  return (
    <div className="mb-4 grid gap-3">
      <div className="relative">
        <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nom, téléphone, email, ville…"
          className="pl-9"
          aria-label="Rechercher un contact"
        />
        {pending && <Loader2Icon className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        {[{ value: "", label: "Tous" }, ...toOptions(CONTACT_ROLES)].map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => update({ role: o.value, stage: "" })}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium",
              role === o.value ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent",
            )}
          >
            {o.label === "Tous" ? o.label : `${o.label}s`}
          </button>
        ))}
      </div>

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
