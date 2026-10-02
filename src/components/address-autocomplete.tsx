"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2Icon, Loader2Icon, MapPinIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Field } from "@/components/form-fields";
import type { GeocodedAddress } from "@/lib/geocoding";

type Initial = {
  address?: string | null;
  postal_code?: string | null;
  city?: string | null;
  citycode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

/** Valeur transmise au parent à chaque changement (utilisée par l'estimation). */
export type AddressValue = {
  address: string;
  postal_code: string;
  city: string;
  citycode: string;
  latitude: number | null;
  longitude: number | null;
};

/**
 * Champs « adresse / code postal / ville » avec suggestions d'adresses (géocodage IGN).
 * Choisir une suggestion renseigne aussi la position GPS (champs cachés latitude / longitude),
 * indispensable pour l'estimation DVF. Si aucune suggestion n'est choisie, le serveur
 * tentera de localiser l'adresse au moment de l'enregistrement.
 */
export function AddressAutocomplete({
  initial,
  errors = {},
  onChange,
}: {
  initial?: Initial;
  errors?: Record<string, string>;
  onChange?: (value: AddressValue) => void;
}) {
  const [address, setAddress] = useState(initial?.address ?? "");
  const [postalCode, setPostalCode] = useState(initial?.postal_code ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [citycode, setCitycode] = useState(initial?.citycode ?? "");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    initial?.latitude != null && initial?.longitude != null ? { lat: initial.latitude, lng: initial.longitude } : null,
  );
  const [suggestions, setSuggestions] = useState<GeocodedAddress[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const skipNextSearch = useRef(true);

  // Recherche des suggestions 300 ms après la dernière frappe.
  useEffect(() => {
    if (skipNextSearch.current) {
      skipNextSearch.current = false;
      return;
    }
    const q = [address, postalCode, city].filter(Boolean).join(" ").trim();
    if (address.trim().length < 4) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/geocodage?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        const json = (await res.json()) as { results?: GeocodedAddress[] };
        setSuggestions(json.results ?? []);
        setOpen(true);
      } catch {
        // Service indisponible : la saisie manuelle reste possible.
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [address, postalCode, city]);

  function choose(s: GeocodedAddress) {
    skipNextSearch.current = true;
    setAddress(s.street || s.label);
    setPostalCode(s.postalCode);
    setCity(s.city);
    setCitycode(s.citycode);
    setCoords({ lat: s.latitude, lng: s.longitude });
    setOpen(false);
    onChange?.({
      address: s.street || s.label,
      postal_code: s.postalCode,
      city: s.city,
      citycode: s.citycode,
      latitude: s.latitude,
      longitude: s.longitude,
    });
  }

  // Toute modification manuelle annule la position GPS (elle sera recalculée).
  function edit(field: "address" | "postal_code" | "city", setter: (v: string) => void) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setter(e.target.value);
      setCoords(null);
      setCitycode("");
      const current = { address, postal_code: postalCode, city, citycode: "", latitude: null, longitude: null };
      onChange?.({ ...current, [field]: e.target.value });
    };
  }

  return (
    <div className="grid gap-4">
      <input type="hidden" name="latitude" value={coords?.lat ?? ""} />
      <input type="hidden" name="longitude" value={coords?.lng ?? ""} />
      <input type="hidden" name="citycode" value={citycode} />

      <div className="relative">
        <Field label="Adresse" htmlFor="address" error={errors.address}>
          <Input
            id="address"
            name="address"
            value={address}
            onChange={edit("address", setAddress)}
            onFocus={() => suggestions.length && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            autoComplete="off"
            placeholder="ex. 12 rue Crébillon"
          />
        </Field>
        {loading && <Loader2Icon className="absolute top-9 right-3 size-4 animate-spin text-muted-foreground" />}
        {open && suggestions.length > 0 && (
          <ul className="absolute z-30 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-lg">
            {suggestions.map((s) => (
              <li key={`${s.label}-${s.latitude}`}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(s)}
                  className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm hover:bg-accent"
                >
                  <MapPinIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="grid grid-cols-[8rem_1fr] gap-4">
        <Field label="Code postal" htmlFor="postal_code" error={errors.postal_code}>
          <Input id="postal_code" name="postal_code" inputMode="numeric" maxLength={5} value={postalCode} onChange={edit("postal_code", setPostalCode)} />
        </Field>
        <Field label="Ville" htmlFor="city" error={errors.city}>
          <Input id="city" name="city" value={city} onChange={edit("city", setCity)} />
        </Field>
      </div>
      <p className="-mt-2 flex items-center gap-1 text-xs text-muted-foreground">
        {coords ? (
          <>
            <CheckCircle2Icon className="size-3.5 text-success" /> Adresse localisée sur la carte.
          </>
        ) : (
          "Choisissez une adresse dans les suggestions pour la localiser (nécessaire pour l'estimation DVF)."
        )}
      </p>
    </div>
  );
}
