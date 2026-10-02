"use client";

import { useEffect } from "react";
import { Circle, CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import { boundingBox, type Comparable } from "@/lib/estimation";
import { formatDate, formatEuros, formatEurosPerSqm, formatSurface } from "@/lib/format";

type Props = {
  center: { latitude: number; longitude: number };
  radiusM: number;
  comparables: Comparable[];
  onToggle?: (id: string) => void;
};

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

/**
 * Carte OpenStreetMap des ventes comparables (Leaflet).
 * - point bleu foncé : le bien estimé ; cercle : rayon de recherche ;
 * - points bleus : ventes retenues ; points gris : ventes exclues.
 * Toucher un point affiche le détail de la vente et permet de l'exclure ou de la réintégrer.
 */
export default function ComparablesMap({ center, radiusM, comparables, onToggle }: Props) {
  const b = boundingBox(center.latitude, center.longitude, radiusM);
  return (
    <MapContainer
      bounds={[
        [b.minLat, b.minLon],
        [b.maxLat, b.maxLon],
      ]}
      scrollWheelZoom={false}
      className="z-0 h-72 w-full rounded-lg sm:h-96"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">contributeurs OpenStreetMap</a>'
        url={process.env.NEXT_PUBLIC_OSM_TILE_URL ?? "https://tile.openstreetmap.org/{z}/{x}/{y}.png"}
      />
      <FitToRadius center={center} radiusM={radiusM} />
      <Circle
        center={[center.latitude, center.longitude]}
        radius={radiusM}
        pathOptions={{ color: "#2f4fd8", weight: 1, fillOpacity: 0.04 }}
      />
      {comparables.map((c) => (
        <CircleMarker
          key={c.id}
          center={[c.latitude, c.longitude]}
          radius={7}
          pathOptions={{
            color: "#ffffff",
            weight: 2,
            fillColor: c.excluded ? "#9ca3af" : "#3b82f6",
            fillOpacity: c.excluded ? 0.6 : 0.95,
          }}
        >
          <Popup>
            <div className="grid gap-1 text-sm">
              <strong>{formatEuros(c.price)}</strong>
              <span>
                {formatSurface(c.surface)} · {formatEurosPerSqm(c.pricePerSqm)}
              </span>
              <span>Vendu le {formatDate(c.date)}</span>
              {c.label && <span>{c.label}</span>}
              {onToggle && (
                <button type="button" onClick={() => onToggle(c.id)} className="mt-1 text-left font-medium text-[#2f4fd8] underline">
                  {c.excluded ? "Réintégrer cette vente" : "Exclure cette vente"}
                </button>
              )}
            </div>
          </Popup>
        </CircleMarker>
      ))}
      <CircleMarker
        center={[center.latitude, center.longitude]}
        radius={9}
        pathOptions={{ color: "#ffffff", weight: 3, fillColor: "#1e3a8a", fillOpacity: 1 }}
      >
        <Popup>Bien estimé</Popup>
      </CircleMarker>
    </MapContainer>
  );
}
