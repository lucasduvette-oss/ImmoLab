"use client";

import { useEffect } from "react";
import L from "leaflet";
import { Circle, CircleMarker, MapContainer, Popup, TileLayer, ZoomControl, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import { boundingBox, type Comparable } from "@/lib/estimation";
import { formatDate, formatEuros, formatEurosPerSqm, formatSurface } from "@/lib/format";

type Props = {
  center: { latitude: number; longitude: number };
  radiusM: number;
  comparables: Comparable[];
  onToggle?: (id: string) => void;
};

const KEPT_COLOR = "#3b82f6";
const EXCLUDED_COLOR = "#9ca3af";
const SUBJECT_COLOR = "#1e3a8a";

/** Recadre la carte sur la zone de recherche quand le rayon ou le centre change. */
function FitToRadius({ center, radiusM }: Pick<Props, "center" | "radiusM">) {
  const map = useMap();
  useEffect(() => {
    const b = boundingBox(center.latitude, center.longitude, radiusM);
    map.fitBounds(
      [
        [b.minLat, b.minLon],
        [b.maxLat, b.maxLon],
      ],
      { padding: [12, 12] },
    );
  }, [map, center.latitude, center.longitude, radiusM]);
  return null;
}

/** Leaflet nomme en anglais le bouton de fermeture des bulles : on le renomme pour les lecteurs d'écran. */
function FrenchPopupClose() {
  useMapEvents({
    popupopen(e) {
      e.popup.getElement()?.querySelector(".leaflet-popup-close-button")?.setAttribute("aria-label", "Fermer");
    },
  });
  return null;
}

/** Regroupe les ventes situées au même endroit (ex. plusieurs appartements d'un même immeuble). */
function groupByPosition(comparables: Comparable[]) {
  const groups = new Map<string, Comparable[]>();
  for (const c of comparables) {
    const key = `${c.latitude.toFixed(5)},${c.longitude.toFixed(5)}`;
    const group = groups.get(key);
    if (group) group.push(c);
    else groups.set(key, [c]);
  }
  return [...groups.entries()];
}

/**
 * Carte OpenStreetMap des ventes comparables (Leaflet).
 * - grand point bleu foncé : le bien estimé ; cercle : rayon de recherche ;
 * - points bleus : ventes retenues ; points gris : ventes exclues ;
 * - un point plus gros réunit plusieurs ventes au même endroit (même immeuble).
 * Toucher un point affiche le détail des ventes et permet de les exclure ou de les réintégrer.
 * Sur téléphone, la carte ne se déplace pas au doigt (pour pouvoir faire défiler la page) ; le zoom à deux doigts reste possible.
 */
export default function ComparablesMap({ center, radiusM, comparables, onToggle }: Props) {
  const b = boundingBox(center.latitude, center.longitude, radiusM);
  return (
    <div className="grid gap-2">
      <MapContainer
        bounds={[
          [b.minLat, b.minLon],
          [b.maxLat, b.maxLon],
        ]}
        scrollWheelZoom={false}
        dragging={!L.Browser.mobile}
        zoomControl={false}
        className="z-0 h-72 w-full rounded-lg sm:h-96"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">contributeurs OpenStreetMap</a>'
          url={process.env.NEXT_PUBLIC_OSM_TILE_URL ?? "https://tile.openstreetmap.org/{z}/{x}/{y}.png"}
        />
        <ZoomControl position="topleft" zoomInTitle="Zoomer" zoomOutTitle="Dézoomer" />
        <FitToRadius center={center} radiusM={radiusM} />
        <FrenchPopupClose />
        <Circle
          center={[center.latitude, center.longitude]}
          radius={radiusM}
          pathOptions={{ color: "#2f4fd8", weight: 1, fillOpacity: 0.04 }}
        />
        {/* Le bien estimé est dessiné en premier : une vente du même immeuble reste visible et cliquable par-dessus. */}
        <CircleMarker
          center={[center.latitude, center.longitude]}
          radius={11}
          pathOptions={{ color: "#ffffff", weight: 3, fillColor: SUBJECT_COLOR, fillOpacity: 1 }}
        >
          <Popup>Bien estimé</Popup>
        </CircleMarker>
        {groupByPosition(comparables).map(([key, group]) => {
          const allExcluded = group.every((c) => c.excluded);
          return (
            <CircleMarker
              key={key}
              center={[group[0].latitude, group[0].longitude]}
              radius={group.length > 1 ? 9 : 7}
              pathOptions={{
                color: "#ffffff",
                weight: 2,
                fillColor: allExcluded ? EXCLUDED_COLOR : KEPT_COLOR,
                fillOpacity: allExcluded ? 0.6 : 0.95,
              }}
            >
              <Popup>
                <div className="grid max-h-60 gap-3 overflow-y-auto text-sm">
                  {group.length > 1 && <strong>{group.length} ventes à cet endroit</strong>}
                  {group.map((c) => (
                    <div key={c.id} className="grid gap-0.5">
                      <strong className={c.excluded ? "text-[#6b7280]" : undefined}>
                        {formatEuros(c.price)}
                        {c.excluded && " (exclue)"}
                      </strong>
                      <span>
                        {formatSurface(c.surface)} · {formatEurosPerSqm(c.pricePerSqm)}
                      </span>
                      <span>Vendu le {formatDate(c.date)}</span>
                      {c.label && <span>{c.label}</span>}
                      {onToggle && (
                        <button type="button" onClick={() => onToggle(c.id)} className="py-1 text-left font-medium text-[#2f4fd8] underline">
                          {c.excluded ? "Réintégrer cette vente" : "Exclure cette vente"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <Legend color={SUBJECT_COLOR} label="Bien estimé" />
        <Legend color={KEPT_COLOR} label="Vente retenue" />
        <Legend color={EXCLUDED_COLOR} label="Vente exclue" />
      </p>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
