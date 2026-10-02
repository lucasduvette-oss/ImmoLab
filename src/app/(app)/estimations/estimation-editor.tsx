"use client";

import { useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangleIcon, Loader2Icon, MapIcon, SaveIcon, SearchIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { AddressAutocomplete, type AddressValue } from "@/components/address-autocomplete";
import { ComparablesMapLazy as ComparablesMap } from "@/components/estimation/comparables-map-lazy";
import { Field } from "@/components/form-fields";
import {
  ADJUSTMENT_LABELS,
  MIN_COMPARABLES,
  computeEstimation,
  totalAdjustment,
  type Adjustments,
  type Comparable,
  type EstimationPropertyType,
  type Fees,
} from "@/lib/estimation";
import { formatDate, formatEuros, formatEurosPerSqm, formatNumber, formatPercent, formatSurface, parseFrenchNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { saveEstimation, searchComparables } from "./actions";

export type EditorInitial = {
  id: string | null;
  propertyId: string | null;
  subject: AddressValue & { type: EstimationPropertyType; surface: number | null; rooms: number | null };
  params: { radiusM: number; periodYears: number; surfaceTolerancePct: number };
  comparables: Comparable[];
  dataSource: string | null;
  adjustments: Adjustments;
  fees: Fees;
  recommendedOverride: number | null;
  arguments: string;
};

const RADII = [250, 500, 750, 1000, 1500, 2000, 3000];
const PERIODS = [1, 2, 3, 4, 5];
const TOLERANCES = [10, 20, 30, 50];

/** Champ numérique « à la française » (virgule décimale), conservé sous forme de texte pendant la saisie. */
function NumberInput({ value, onChange, ...props }: Omit<React.ComponentProps<typeof Input>, "value" | "onChange"> & { value: string; onChange: (v: string) => void }) {
  return <Input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} {...props} />;
}

const str = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n).replace(".", ","));

/** Empreinte des critères d'une recherche : si elle change, les ventes affichées ne correspondent plus. */
function criteriaKey(
  type: EstimationPropertyType,
  latitude: number | null,
  longitude: number | null,
  surface: number | null,
  params: EditorInitial["params"],
) {
  return JSON.stringify([type, latitude, longitude, surface, params.radiusM, params.periodYears, params.surfaceTolerancePct]);
}

const NETWORK_ERROR = "Connexion impossible avec le serveur : vos saisies sont conservées, réessayez dans un instant.";

/** Écran d'estimation : saisie du bien, recherche DVF, sélection des comparables, ajustements, résultat. */
export function EstimationEditor({ initial }: { initial: EditorInitial }) {
  const [type, setType] = useState<EstimationPropertyType>(initial.subject.type);
  const [address, setAddress] = useState<AddressValue>(initial.subject);
  const [surfaceText, setSurfaceText] = useState(str(initial.subject.surface));
  const [roomsText, setRoomsText] = useState(str(initial.subject.rooms));
  const [params, setParams] = useState(initial.params);
  const [comparables, setComparables] = useState<Comparable[]>(initial.comparables);
  const [dataSource, setDataSource] = useState(initial.dataSource);
  // Une estimation reprise part de la recherche enregistrée : ses critères sont ceux de départ.
  const [searchedKey, setSearchedKey] = useState<string | null>(
    initial.comparables.length
      ? criteriaKey(initial.subject.type, initial.subject.latitude, initial.subject.longitude, initial.subject.surface, initial.params)
      : null,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [adjText, setAdjText] = useState<Record<keyof Adjustments, string>>(
    Object.fromEntries(Object.entries(initial.adjustments).map(([k, v]) => [k, v ? str(v) : ""])) as Record<keyof Adjustments, string>,
  );
  const [feesMode, setFeesMode] = useState<Fees["mode"]>(initial.fees.mode);
  const [feesText, setFeesText] = useState(str(initial.fees.value));
  const [feesChargedTo, setFeesChargedTo] = useState<Fees["chargedTo"]>(initial.fees.chargedTo);
  const [recommendedText, setRecommendedText] = useState(str(initial.recommendedOverride));
  const [argumentsText, setArgumentsText] = useState(initial.arguments);
  const [searching, startSearch] = useTransition();
  const [saving, startSave] = useTransition();

  const surface = parseFrenchNumber(surfaceText);
  const rooms = parseFrenchNumber(roomsText);
  const adjustments = Object.fromEntries(
    Object.entries(adjText).map(([k, v]) => [k, parseFrenchNumber(v) ?? 0]),
  ) as Adjustments;
  const fees: Fees = { mode: feesMode, value: parseFrenchNumber(feesText) ?? 0, chargedTo: feesChargedTo };
  const recommendedOverride = parseFrenchNumber(recommendedText);

  // Les paramètres ont-ils changé depuis la dernière recherche ?
  const searchKey = criteriaKey(type, address.latitude, address.longitude, surface, params);
  const stale = searchedKey !== null && searchedKey !== searchKey;
  const adjustmentsTooLow = totalAdjustment(adjustments) <= -100;

  // Calcul instantané (quelques dizaines de ventes) : refait à chaque modification.
  const result = surface ? computeEstimation({ comparables, surface, adjustments, fees, recommendedOverride }) : null;
  const kept = comparables.filter((c) => !c.excluded).length;
  const located = address.latitude !== null && address.longitude !== null;

  function search() {
    if (!located) return toast.error("Choisissez une adresse dans les suggestions pour la localiser.");
    if (!surface) return toast.error("Indiquez la surface habitable du bien.");
    toast.dismiss();
    startSearch(async () => {
      let res: Awaited<ReturnType<typeof searchComparables>>;
      try {
        res = await searchComparables({
          type,
          address: address.address || null,
          postal_code: address.postal_code || null,
          city: address.city || null,
          citycode: address.citycode || null,
          latitude: address.latitude!,
          longitude: address.longitude!,
          surface,
          rooms: rooms !== null ? Math.round(rooms) : null,
          ...params,
        });
      } catch {
        // Réseau coupé, délai dépassé… : l'écran et les saisies restent en place.
        toast.error(NETWORK_ERROR);
        return;
      }
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      setComparables(res.comparables);
      setDataSource(res.source);
      setNotice(res.notice ?? null);
      setSearchedKey(searchKey);
      if (res.comparables.length === 0) toast.warning("Aucune vente comparable trouvée : élargissez le rayon ou la période.");
      else toast.success(`${res.comparables.length} vente${res.comparables.length > 1 ? "s" : ""} trouvée${res.comparables.length > 1 ? "s" : ""}.`);
    });
  }

  function toggle(id: string) {
    setComparables((cs) => cs.map((c) => (c.id === id ? { ...c, excluded: !c.excluded } : c)));
  }

  function save() {
    if (!located || !surface) return toast.error("Le bien doit être localisé et avoir une surface.");
    if (stale) return toast.error("Les critères ont changé : relancez la recherche avant d'enregistrer.");
    if (!result) return toast.error("Recherchez et retenez au moins une vente comparable avant d'enregistrer.");
    toast.dismiss();
    startSave(async () => {
      let res: Awaited<ReturnType<typeof saveEstimation>>;
      try {
        res = await saveEstimation({
          id: initial.id,
          property_id: initial.propertyId,
          type,
          address: address.address || null,
          postal_code: address.postal_code || null,
          city: address.city || null,
          citycode: address.citycode || null,
          latitude: address.latitude!,
          longitude: address.longitude!,
          surface,
          rooms: rooms !== null ? Math.round(rooms) : null,
          ...params,
          data_source: dataSource,
          comparables,
          adjustments,
          fees,
          recommendedOverride: recommendedOverride && recommendedOverride > 0 ? recommendedOverride : null,
          arguments: argumentsText.trim() || null,
        });
      } catch (e) {
        // La redirection vers la page de l'estimation (après enregistrement) passe aussi par ici : on la laisse faire.
        unstable_rethrow(e);
        toast.error(NETWORK_ERROR);
        return;
      }
      if (res && "error" in res) toast.error(res.error);
    });
  }

  const sorted = [...comparables].sort((a, b) => a.distance - b.distance);

  return (
    <div className="grid gap-4">
      {/* ------------------------------------------------------------ Bien */}
      <Card>
        <CardHeader className="flex-col">
          <CardTitle>1. Bien à estimer</CardTitle>
          <CardDescription>L&apos;estimation DVF porte sur les appartements et les maisons.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-2 gap-2">
            {(["appartement", "maison"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                aria-pressed={type === t}
                className={cn("rounded-md border px-3 py-2 text-sm font-medium", type === t ? "border-primary bg-accent text-primary" : "bg-card")}
              >
                {t === "appartement" ? "Appartement" : "Maison"}
              </button>
            ))}
          </div>
          <AddressAutocomplete initial={initial.subject} onChange={setAddress} />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Surface habitable (m²) *" htmlFor="surface">
              <NumberInput id="surface" value={surfaceText} onChange={setSurfaceText} />
            </Field>
            <Field label="Pièces" htmlFor="rooms">
              <NumberInput id="rooms" value={roomsText} onChange={setRoomsText} inputMode="numeric" />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* ----------------------------------------------------- Recherche */}
      <Card>
        <CardHeader className="flex-col">
          <CardTitle>2. Ventes comparables (DVF)</CardTitle>
          <CardDescription>
            Ventes réelles de même type, dans le rayon et la période choisis, avec une surface à ±{params.surfaceTolerancePct} %.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-3 gap-2">
            <Field label="Rayon" htmlFor="radius">
              <NativeSelect id="radius" value={params.radiusM} onChange={(e) => setParams({ ...params, radiusM: Number(e.target.value) })}>
                {RADII.map((r) => (
                  <option key={r} value={r}>
                    {r < 1000 ? `${r} m` : `${formatNumber(r / 1000)} km`}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Période" htmlFor="period">
              <NativeSelect id="period" value={params.periodYears} onChange={(e) => setParams({ ...params, periodYears: Number(e.target.value) })}>
                {PERIODS.map((p) => (
                  <option key={p} value={p}>
                    {p} an{p > 1 ? "s" : ""}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Surface" htmlFor="tolerance">
              <NativeSelect
                id="tolerance"
                value={params.surfaceTolerancePct}
                onChange={(e) => setParams({ ...params, surfaceTolerancePct: Number(e.target.value) })}
              >
                {TOLERANCES.map((t) => (
                  <option key={t} value={t}>
                    ± {t} %
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <Button type="button" onClick={search} disabled={searching} variant={stale || comparables.length === 0 ? "default" : "outline"}>
            {searching ? <Loader2Icon className="animate-spin" /> : <SearchIcon />}
            {searching ? "Recherche en cours…" : comparables.length ? "Relancer la recherche" : "Rechercher les ventes comparables"}
          </Button>
          {stale && <p className="text-sm text-amber-700">Les critères ont changé : relancez la recherche pour mettre à jour les ventes.</p>}
          {notice && <p className="text-sm text-muted-foreground">{notice}</p>}

          {located && (comparables.length > 0 || searchedKey) && (
            <ComparablesMap
              center={{ latitude: address.latitude!, longitude: address.longitude! }}
              radiusM={params.radiusM}
              comparables={comparables}
              onToggle={toggle}
            />
          )}

          {comparables.length > 0 && (
            <>
              <p className="flex items-center gap-2 text-sm">
                <MapIcon className="size-4 text-muted-foreground" />
                <strong>{kept}</strong> vente{kept > 1 ? "s" : ""} retenue{kept > 1 ? "s" : ""} sur {comparables.length}. Décochez une vente pour l&apos;exclure du calcul.
              </p>
              <div className="-mx-4 overflow-x-auto md:mx-0">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr className="border-b">
                      <th className="px-2 py-2 font-medium">Retenue</th>
                      <th className="px-2 py-2 font-medium">Date</th>
                      <th className="px-2 py-2 text-right font-medium">Surface</th>
                      <th className="px-2 py-2 text-right font-medium">Pièces</th>
                      <th className="px-2 py-2 text-right font-medium">Prix</th>
                      <th className="px-2 py-2 text-right font-medium">Prix/m²</th>
                      <th className="px-2 py-2 text-right font-medium">Distance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((c) => (
                      <tr key={c.id} className={cn("border-b last:border-0", c.excluded && "text-muted-foreground")}>
                        <td className="px-2 py-2">
                          <label className="-my-2 flex min-h-10 min-w-10 cursor-pointer items-center gap-2">
                            <input
                              type="checkbox"
                              checked={!c.excluded}
                              onChange={() => toggle(c.id)}
                              className="size-4 accent-[var(--primary)]"
                              aria-label={`Retenir la vente du ${formatDate(c.date)} à ${formatEuros(c.price)}`}
                            />
                            {c.outlier && <Badge variant="warning">Atypique</Badge>}
                          </label>
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap">{formatDate(c.date)}</td>
                        <td className="px-2 py-2 text-right whitespace-nowrap">{formatSurface(c.surface)}</td>
                        <td className="px-2 py-2 text-right">{c.rooms ?? "—"}</td>
                        <td className="px-2 py-2 text-right whitespace-nowrap">{formatEuros(c.price)}</td>
                        <td className={cn("px-2 py-2 text-right whitespace-nowrap", !c.excluded && "font-medium")}>{formatEurosPerSqm(c.pricePerSqm)}</td>
                        <td className="px-2 py-2 text-right whitespace-nowrap">{formatNumber(Math.round(c.distance))} m</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* -------------------------------------------------- Ajustements */}
      <Card>
        <CardHeader className="flex-col">
          <CardTitle>3. Ajustements</CardTitle>
          <CardDescription>En % (ex. « -5 » pour un DPE défavorable, « 3 » pour une belle terrasse). Laissez vide si sans effet.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {(Object.keys(ADJUSTMENT_LABELS) as (keyof Adjustments)[]).map((k) => (
              <Field key={k} label={`${ADJUSTMENT_LABELS[k]} (%)`} htmlFor={`adj-${k}`}>
                {/* Clavier complet : le pavé décimal de l'iPhone n'a pas de signe « - ». */}
                <NumberInput
                  id={`adj-${k}`}
                  inputMode="text"
                  value={adjText[k]}
                  onChange={(v) => setAdjText({ ...adjText, [k]: v })}
                  placeholder="0"
                />
              </Field>
            ))}
          </div>
          {adjustmentsTooLow && (
            <p className="mt-3 text-sm text-destructive">Le total des ajustements doit rester supérieur à -100 %.</p>
          )}
        </CardContent>
      </Card>

      {/* ------------------------------------------------------ Résultat */}
      <Card>
        <CardHeader className="flex-col">
          <CardTitle>4. Résultat</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {!result ? (
            <p className="text-sm text-muted-foreground">
              {adjustmentsTooLow
                ? "Corrigez les ajustements pour afficher le résultat."
                : "Le résultat s'affiche dès qu'au moins une vente comparable est retenue."}
            </p>
          ) : (
            <>
              {result.lowConfidence && (
                <p className="flex items-start gap-2 rounded-md bg-warning/20 px-3 py-2 text-sm text-amber-900">
                  <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
                  Seulement {result.count} vente{result.count > 1 ? "s" : ""} retenue{result.count > 1 ? "s" : ""} (moins de {MIN_COMPARABLES}) :
                  résultat peu fiable. Élargissez le rayon ou la période.
                </p>
              )}
              <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <div className="rounded-lg bg-muted/60 px-3 py-2">
                  <dt className="text-xs text-muted-foreground">Prix médian au m²</dt>
                  <dd className="font-semibold">{formatEurosPerSqm(result.medianPricePerSqm)}</dd>
                </div>
                <div className="rounded-lg bg-muted/60 px-3 py-2">
                  <dt className="text-xs text-muted-foreground">Fourchette basse</dt>
                  <dd className="font-semibold">{formatEuros(result.low)}</dd>
                </div>
                <div className="rounded-lg bg-accent px-3 py-2">
                  <dt className="text-xs text-muted-foreground">Fourchette moyenne</dt>
                  <dd className="font-semibold text-primary">{formatEuros(result.mid)}</dd>
                </div>
                <div className="rounded-lg bg-muted/60 px-3 py-2">
                  <dt className="text-xs text-muted-foreground">Fourchette haute</dt>
                  <dd className="font-semibold">{formatEuros(result.high)}</dd>
                </div>
              </dl>
              <p className="text-xs text-muted-foreground">
                Basse / moyenne / haute : 1er quartile, médiane et 3e quartile des prix au m²{" "}
                {result.count > 1 ? `des ${result.count} ventes retenues` : "de la seule vente retenue"} × {formatSurface(surface)}
                {result.adjustmentPct !== 0 && <> × ajustements ({formatPercent(result.adjustmentPct)})</>}.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Prix de mise en vente conseillé (€)"
                  htmlFor="recommended"
                  hint={
                    feesChargedTo === "acquereur"
                      ? "Laissez vide pour reprendre la valeur moyenne + honoraires, arrondie au millier."
                      : "Laissez vide pour reprendre la valeur moyenne, arrondie au millier."
                  }
                >
                  <NumberInput id="recommended" value={recommendedText} onChange={setRecommendedText} placeholder={formatNumber(result.recommendedPrice)} />
                </Field>
                <div className="grid grid-cols-[1fr_6rem] gap-2">
                  <Field label="Honoraires" htmlFor="fees">
                    <NumberInput id="fees" value={feesText} onChange={setFeesText} />
                  </Field>
                  <Field label="Unité" htmlFor="fees-mode">
                    <NativeSelect id="fees-mode" value={feesMode} onChange={(e) => setFeesMode(e.target.value as Fees["mode"])}>
                      <option value="pourcentage">%</option>
                      <option value="montant">€</option>
                    </NativeSelect>
                  </Field>
                </div>
                <Field label="Honoraires à la charge" htmlFor="fees-charged">
                  <NativeSelect id="fees-charged" value={feesChargedTo} onChange={(e) => setFeesChargedTo(e.target.value as Fees["chargedTo"])}>
                    <option value="vendeur">du vendeur</option>
                    <option value="acquereur">de l&apos;acquéreur</option>
                  </NativeSelect>
                </Field>
              </div>

              <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="rounded-lg border-2 border-primary px-3 py-2">
                  <dt className="text-xs text-muted-foreground">Prix de mise en vente (honoraires inclus)</dt>
                  <dd className="text-xl font-bold text-primary">{formatEuros(result.recommendedPrice)}</dd>
                </div>
                <div className="rounded-lg bg-muted/60 px-3 py-2">
                  <dt className="text-xs text-muted-foreground">Honoraires</dt>
                  <dd className="text-lg font-semibold">{formatEuros(result.feesAmount)}</dd>
                </div>
                <div className="rounded-lg bg-success/10 px-3 py-2">
                  <dt className="text-xs text-muted-foreground">Prix net vendeur</dt>
                  <dd className="text-xl font-bold text-success">{formatEuros(result.netSellerPrice)}</dd>
                </div>
              </dl>
              <p className="text-xs text-muted-foreground">
                Les prix DVF sont ceux des actes de vente : ils incluent les honoraires payés par le vendeur, mais pas ceux payés
                par l&apos;acquéreur. {feesChargedTo === "acquereur"
                  ? "Honoraires à la charge de l'acquéreur : la valeur moyenne correspond au net vendeur, les honoraires s'y ajoutent."
                  : "Honoraires à la charge du vendeur : la valeur moyenne correspond au prix de mise en vente, honoraires compris."}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* --------------------------------------------------- Argumentaire */}
      <Card>
        <CardHeader className="flex-col">
          <CardTitle>5. Argumentaire</CardTitle>
          <CardDescription>Repris dans le rapport PDF remis au vendeur.</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={argumentsText}
            onChange={(e) => setArgumentsText(e.target.value)}
            rows={6}
            placeholder="Points forts, points d'attention, contexte du marché local, stratégie de prix…"
            aria-label="Argumentaire"
          />
        </CardContent>
      </Card>

      {/* Au-dessus de la barre de navigation du téléphone (y compris la zone du geste « accueil » de l'iPhone). */}
      <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-10 flex flex-col items-end gap-1 md:bottom-4">
        {stale && result && (
          <p className="rounded-md bg-card px-2 py-1 text-xs text-amber-700 shadow-sm">Relancez la recherche avant d&apos;enregistrer.</p>
        )}
        <Button type="button" size="lg" onClick={save} disabled={saving || !result || stale} className="w-full shadow-lg sm:w-auto">
          {saving ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
          {saving ? "Enregistrement…" : initial.id ? "Enregistrer les modifications" : "Enregistrer l'estimation"}
        </Button>
      </div>
    </div>
  );
}
