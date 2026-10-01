"use client";

import { Loader2Icon, SearchIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Champ de recherche d'une liste (avec indicateur de chargement). */
export function SearchInput({
  value,
  onChange,
  placeholder,
  pending,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  pending?: boolean;
  label: string;
}) {
  return (
    <div className="relative">
      <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pl-9" aria-label={label} />
      {pending && <Loader2Icon className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
    </div>
  );
}

/** Rangée de « pastilles » de filtre, défilant horizontalement sur téléphone. */
export function FilterChips({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn(
            "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium",
            value === o.value ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
