import { Circle, Document, Font, Image, Page, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";

import { ADJUSTMENT_LABELS, type Adjustments } from "@/lib/estimation";
import { formatDate, formatEuros, formatEurosPerSqm, formatNumber, formatPercent, formatPhone, formatSurface } from "@/lib/format";
import type { EstimationRow } from "@/lib/queries/estimations";
import { OUTDOOR_TYPES, PARKING_TYPES, PROPERTY_CONDITIONS } from "@/lib/constants";
import type { StaticMap } from "@/lib/static-map";
import type { Profile, Property } from "@/lib/types";
import { toWinAnsi } from "./winansi";

/**
 * Rapport d'estimation (avis de valeur) au format PDF, généré côté serveur avec @react-pdf/renderer.
 * Police : Helvetica (police standard des PDF, accents français et symbole € inclus).
 */

/** Tout texte affiché passe par t() : Helvetica n'a pas tous les caractères (voir winansi.ts). */
const t = toWinAnsi;

// La césure par défaut est prévue pour l'anglais : on ne coupe les mots qu'après un trait d'union
// (ex. « Saint-Rémy-en-Bouzemont » peut passer à la ligne après « Saint- »).
Font.registerHyphenationCallback((word) => word.split(/(?<=-)/));

/** Nombre maximal de ventes listées dans le tableau (les plus proches) ; toutes restent dans le calcul. */
const MAX_TABLE_ROWS = 60;

const BLUE = "#2f4fd8";
const DARK = "#1f2937";
const MUTED = "#6b7280";
// Libellés sur fond gris : plus foncé pour rester lisible une fois imprimé.
const LABEL = "#4b5563";
const LIGHT = "#f3f4f6";

const styles = StyleSheet.create({
  // Pas d'interligne sur la page ni sur un bloc parent : avec react-pdf, cela fait disparaître le pied de page
  // « fixe » ou espace exagérément les lignes. L'interligne est donc donné aux seuls paragraphes (style « para »).
  page: { paddingTop: 36, paddingBottom: 48, paddingHorizontal: 36, fontSize: 10, fontFamily: "Helvetica", color: DARK },
  // Interligne sans unité : react-pdf le calcule d'après la taille de police du même style (18 pt par défaut),
  // d'où la taille indiquée ici ; avec « small », placer « small » après « para » pour garder 8 pt.
  para: { fontSize: 10, lineHeight: 1.4 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 18 },
  headerLeft: { maxWidth: "45%" },
  logo: { maxWidth: 140, maxHeight: 60, objectFit: "contain" },
  agency: { maxWidth: "55%", flexShrink: 1, textAlign: "right", fontSize: 9, color: MUTED },
  agencyName: { fontSize: 12, lineHeight: 1.3, fontFamily: "Helvetica-Bold", color: DARK },
  title: { fontSize: 22, lineHeight: 1.2, fontFamily: "Helvetica-Bold", color: BLUE, marginBottom: 4 },
  subtitle: { fontSize: 10, color: MUTED, marginBottom: 16 },
  section: { marginBottom: 16 },
  h2: {
    fontSize: 13,
    lineHeight: 1.3,
    fontFamily: "Helvetica-Bold",
    color: DARK,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  row: { flexDirection: "row", gap: 12 },
  tile: { flex: 1, backgroundColor: LIGHT, borderRadius: 4, padding: 8 },
  tileLabel: { fontSize: 8, color: LABEL, marginBottom: 2 },
  tileValue: { fontSize: 12, lineHeight: 1.3, fontFamily: "Helvetica-Bold" },
  bigBox: { borderWidth: 2, borderColor: BLUE, borderRadius: 6, padding: 12, marginBottom: 10 },
  bigValue: { fontSize: 24, lineHeight: 1.2, fontFamily: "Helvetica-Bold", color: BLUE },
  photo: { width: 200, height: 140, objectFit: "cover", borderRadius: 4 },
  table: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 4 },
  th: { flexDirection: "row", backgroundColor: LIGHT, fontFamily: "Helvetica-Bold", fontSize: 8, color: LABEL },
  tr: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#e5e7eb", fontSize: 9 },
  cell: { paddingVertical: 4, paddingHorizontal: 5 },
  small: { fontSize: 8, color: MUTED },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: MUTED,
  },
  footerText: { flex: 1, marginRight: 12 },
});

const COLS = [
  { key: "date", label: "Date", width: "14%", align: "left" },
  { key: "label", label: "Adresse / commune", width: "30%", align: "left" },
  { key: "surface", label: "Surface", width: "11%", align: "right" },
  { key: "rooms", label: "Pièces", width: "8%", align: "right" },
  { key: "price", label: "Prix", width: "14%", align: "right" },
  { key: "ppsm", label: "Prix/m²", width: "12%", align: "right" },
  { key: "distance", label: "Distance", width: "11%", align: "right" },
] as const;

export type ReportData = {
  estimation: EstimationRow;
  profile: Profile | null;
  logo: Buffer | null; // PNG ou JPEG
  property: Property | null;
  photo: Buffer | null; // PNG ou JPEG
  map: StaticMap | null;
  generatedAt: Date;
};

function Tile({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={[styles.tile, highlight ? { backgroundColor: "#e8edff" } : {}]}>
      <Text style={styles.tileLabel}>{t(label)}</Text>
      <Text style={[styles.tileValue, highlight ? { color: BLUE } : {}]}>{t(value)}</Text>
    </View>
  );
}

/** Date de l'avis : celle de la dernière modification de l'estimation (les chiffres datent de ce jour-là). */
function establishedAt(e: EstimationRow) {
  return e.updated_at && e.updated_at > e.created_at ? e.updated_at : e.created_at;
}

function Footer({ data }: { data: ReportData }) {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>
        {t(
          `${data.profile?.agency_name || "Avis de valeur"} — établi le ${formatDate(establishedAt(data.estimation))} à partir des données DVF (ventes réelles publiées par l'État)`,
        )}
      </Text>
      {/* Largeur réservée : sinon le texte de gauche, s'il est long, passerait sous le numéro de page. */}
      <Text style={{ width: 40, textAlign: "right" }} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
      <Svg width={7} height={7}>
        <Circle cx={3.5} cy={3.5} r={3.5} fill={color} />
      </Svg>
      <Text style={styles.small}>{label}</Text>
    </View>
  );
}

/**
 * Carte : tuiles OpenStreetMap + cercle de recherche + points des ventes.
 * Échelle : 4 px de carte = 3 pt de PDF (les noms de rues restent lisibles une fois imprimés).
 */
function MapView({ map }: { map: StaticMap }) {
  const scale = 0.75;
  const w = map.widthPx * scale;
  const h = map.heightPx * scale;
  return (
    <View>
      <View style={{ width: w, height: h, position: "relative", overflow: "hidden", borderRadius: 4, backgroundColor: "#e5e7eb" }}>
        {map.tiles.map((tile, i) => (
          // eslint-disable-next-line jsx-a11y/alt-text -- composant PDF (pas de texte alternatif)
          <Image
            key={i}
            src={tile.dataUri}
            // +0,5 pt pour éviter de fins liserés entre les tuiles dans certains lecteurs PDF
            style={{
              position: "absolute",
              left: tile.left * scale,
              top: tile.top * scale,
              width: 256 * scale + 0.5,
              height: 256 * scale + 0.5,
            }}
          />
        ))}
        <Svg width={w} height={h} style={{ position: "absolute", left: 0, top: 0 }}>
          <Circle
            cx={map.center.x * scale}
            cy={map.center.y * scale}
            r={map.radiusPx * scale}
            stroke={BLUE}
            strokeWidth={1}
            fill={BLUE}
            fillOpacity={0.06}
          />
          {map.points
            .filter((p) => p.kind !== "subject")
            .map((p, i) => (
              <Circle
                key={i}
                cx={p.x * scale}
                cy={p.y * scale}
                r={3.5}
                fill={p.kind === "excluded" ? "#9ca3af" : "#3b82f6"}
                stroke="#ffffff"
                strokeWidth={1}
              />
            ))}
          <Circle cx={map.center.x * scale} cy={map.center.y * scale} r={5} fill="#1e3a8a" stroke="#ffffff" strokeWidth={1.5} />
        </Svg>
      </View>
      <View style={[styles.row, { justifyContent: "space-between", alignItems: "center", marginTop: 4 }]}>
        <View style={[styles.row, { gap: 10, alignItems: "center" }]}>
          <LegendDot color="#1e3a8a" label="Bien estimé" />
          <LegendDot color="#3b82f6" label="Ventes retenues" />
          <LegendDot color="#9ca3af" label="Ventes exclues" />
        </View>
        <Text style={styles.small}>© Contributeurs OpenStreetMap — openstreetmap.org/copyright</Text>
      </View>
      {!map.complete && <Text style={styles.small}>Une partie du fond de carte n&apos;a pas pu être chargée.</Text>}
    </View>
  );
}

export function EstimationReport({ data }: { data: ReportData }) {
  const e = data.estimation;
  const p = data.property;
  const kept = e.comparables.filter((c) => !c.excluded).sort((a, b) => a.distance - b.distance);
  const listed = kept.slice(0, MAX_TABLE_ROWS);
  const excludedCount = e.comparables.length - kept.length;
  const adjustments = Object.entries(e.adjustments ?? {}).filter(([, v]) => Number(v) !== 0) as [keyof Adjustments, number][];
  const totalAdj = adjustments.reduce((s, [, v]) => s + Number(v), 0);
  const typeLabel = e.property_type === "maison" ? "Maison" : "Appartement";
  const address = [e.address, [e.postal_code, e.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");

  const characteristics: [string, string][] = [
    ["Type", typeLabel],
    ["Surface habitable", formatSurface(e.surface)],
    ["Pièces", e.rooms ? formatNumber(e.rooms) : "—"],
  ];
  if (p) {
    if (p.bedrooms) characteristics.push(["Chambres", formatNumber(p.bedrooms)]);
    if (p.floor !== null) characteristics.push(["Étage", p.floor === 0 ? "Rez-de-chaussée" : String(p.floor)]);
    if (p.has_elevator !== null) characteristics.push(["Ascenseur", p.has_elevator ? "Oui" : "Non"]);
    if (p.outdoor) characteristics.push(["Extérieur", OUTDOOR_TYPES[p.outdoor]]);
    if (p.parking) characteristics.push(["Stationnement", PARKING_TYPES[p.parking]]);
    if (p.construction_year) characteristics.push(["Construction", String(p.construction_year)]);
    if (p.dpe || p.ges) characteristics.push(["DPE / GES", `${p.dpe ?? "—"} / ${p.ges ?? "—"}`]);
    if (p.condition) characteristics.push(["État", PROPERTY_CONDITIONS[p.condition]]);
  }

  return (
    <Document
      title={`Avis de valeur — ${typeLabel} ${formatSurface(e.surface)}`}
      author={data.profile?.full_name ?? undefined}
      language="fr-FR"
    >
      {/* ----------------------------------------------------- Page 1 */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {data.logo ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- composant PDF
              <Image src={data.logo} style={styles.logo} />
            ) : (
              // Sans logo, le nom de l'agence prend sa place (il n'est alors pas répété à droite).
              <Text style={styles.agencyName}>{t(data.profile?.agency_name ?? "")}</Text>
            )}
          </View>
          <View style={styles.agency}>
            {data.logo && data.profile?.agency_name && <Text style={styles.agencyName}>{t(data.profile.agency_name)}</Text>}
            {data.profile?.agency_address && <Text>{t(data.profile.agency_address)}</Text>}
            {data.profile?.full_name && <Text style={{ marginTop: 4, color: DARK }}>{t(data.profile.full_name)}</Text>}
            {data.profile?.phone && <Text>{t(formatPhone(data.profile.phone))}</Text>}
            {data.profile?.email && <Text>{t(data.profile.email)}</Text>}
          </View>
        </View>

        <Text style={styles.title}>Avis de valeur</Text>
        <Text style={styles.subtitle}>
          {t(`${typeLabel} — ${address || "adresse non renseignée"} — établi le ${formatDate(establishedAt(e))}`)}
        </Text>

        <View style={styles.section}>
          <Text style={styles.h2}>Le bien</Text>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              {characteristics.map(([label, value]) => (
                <View
                  key={label}
                  style={{ flexDirection: "row", paddingVertical: 2, borderBottomWidth: 0.5, borderBottomColor: "#e5e7eb" }}
                >
                  <Text style={{ width: "45%", color: MUTED }}>{t(label)}</Text>
                  <Text style={{ width: "55%", fontFamily: "Helvetica-Bold" }}>{t(value)}</Text>
                </View>
              ))}
            </View>
            {data.photo && (
              // eslint-disable-next-line jsx-a11y/alt-text -- composant PDF
              <Image src={data.photo} style={styles.photo} />
            )}
          </View>
        </View>

        <View style={styles.section} wrap={false}>
          <Text style={styles.h2}>Notre estimation</Text>
          <View style={styles.bigBox}>
            <Text style={styles.tileLabel}>Prix de mise en vente conseillé (honoraires inclus)</Text>
            <Text style={styles.bigValue}>{t(formatEuros(e.recommended_price))}</Text>
          </View>
          <View style={[styles.row, { marginBottom: 8 }]}>
            <Tile label="Fourchette basse" value={formatEuros(e.low_value)} />
            <Tile label="Fourchette moyenne" value={formatEuros(e.mid_value)} highlight />
            <Tile label="Fourchette haute" value={formatEuros(e.high_value)} />
          </View>
          <View style={styles.row}>
            <Tile label="Prix médian au m² des ventes retenues" value={formatEurosPerSqm(e.median_price_sqm)} />
            <Tile
              label={`Honoraires d'agence (charge ${e.fees_charged_to === "acquereur" ? "acquéreur" : "vendeur"})`}
              value={formatEuros(e.fees_amount)}
            />
            <Tile label="Prix net vendeur" value={formatEuros(e.net_seller_price)} />
          </View>
        </View>
        <Footer data={data} />
      </Page>

      {/* -------------------------------------------- Page 2 : comparables */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.h2}>Ventes comparables</Text>
        <Text style={[styles.para, styles.small, { marginBottom: 8 }]}>
          {t(
            `${kept.length} vente${kept.length > 1 ? "s" : ""} de biens comparables (${typeLabel.toLowerCase()}s de ${formatSurface(
              e.surface * (1 - e.surface_tolerance_pct / 100),
            )} à ${formatSurface(e.surface * (1 + e.surface_tolerance_pct / 100))}) dans un rayon de ${formatNumber(e.radius_m)} m, ${
              e.period_years > 1 ? `sur les ${e.period_years} dernières années` : "sur la dernière année"
            }${excludedCount ? ` — ${excludedCount} vente${excludedCount > 1 ? "s" : ""} écartée${excludedCount > 1 ? "s" : ""} (atypiques ou non comparables)` : ""}.`,
          )}
        </Text>
        {data.map && (
          <View style={{ marginBottom: 12 }}>
            <MapView map={data.map} />
          </View>
        )}
        <View style={styles.table}>
          <View style={styles.th} fixed>
            {COLS.map((c) => (
              <Text key={c.key} style={[styles.cell, { width: c.width, textAlign: c.align }]}>
                {t(c.label)}
              </Text>
            ))}
          </View>
          {listed.map((c) => (
            <View key={c.id} style={styles.tr} wrap={false}>
              <Text style={[styles.cell, { width: "14%" }]}>{t(formatDate(c.date))}</Text>
              <Text style={[styles.cell, { width: "30%" }]}>{t(c.label ?? "—")}</Text>
              <Text style={[styles.cell, { width: "11%", textAlign: "right" }]}>{t(formatSurface(c.surface))}</Text>
              <Text style={[styles.cell, { width: "8%", textAlign: "right" }]}>{c.rooms ?? "—"}</Text>
              <Text style={[styles.cell, { width: "14%", textAlign: "right" }]}>{t(formatEuros(c.price))}</Text>
              <Text style={[styles.cell, { width: "12%", textAlign: "right", fontFamily: "Helvetica-Bold" }]}>
                {t(formatEurosPerSqm(c.pricePerSqm))}
              </Text>
              <Text style={[styles.cell, { width: "11%", textAlign: "right" }]}>{t(`${formatNumber(Math.round(c.distance))} m`)}</Text>
            </View>
          ))}
        </View>
        {kept.length > listed.length && (
          <Text style={[styles.small, { marginTop: 4 }]}>
            {t(
              `Les ${listed.length} ventes les plus proches sont listées ; les ${kept.length - listed.length} autres ventes retenues sont prises en compte dans le calcul.`,
            )}
          </Text>
        )}
        <Footer data={data} />
      </Page>

      {/* ------------------------------- Page 3 : argumentaire et méthode */}
      <Page size="A4" style={styles.page}>
        {e.arguments && (
          <View style={styles.section}>
            <Text style={styles.h2}>Notre analyse</Text>
            <Text style={styles.para}>{t(e.arguments)}</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.h2}>Méthode</Text>
          <Text style={[styles.para, { marginBottom: 4 }]}>
            {t(
              `L'estimation s'appuie sur les ventes réellement enregistrées par l'administration fiscale (base « Demandes de valeurs foncières », DVF), publiées en données ouvertes par l'État. Seules les ventes de biens du même type et de surface proche, situées à proximité, sont retenues.`,
            )}
          </Text>
          <Text style={[styles.para, { marginBottom: 4 }]}>
            {t(
              `La fourchette correspond au premier quartile (basse), à la médiane (moyenne) et au troisième quartile (haute) des prix au m² des ventes retenues, appliqués à la surface du bien${
                adjustments.length ? ", puis corrigés des ajustements ci-dessous" : ""
              }.`,
            )}
          </Text>
          <Text style={[styles.para, { marginBottom: 4 }]}>
            {t(
              e.fees_charged_to === "acquereur"
                ? "Les prix DVF sont ceux des actes de vente, hors honoraires payés par l'acquéreur : la valeur obtenue correspond au prix net vendeur, auquel s'ajoutent les honoraires pour former le prix de mise en vente."
                : "Les prix DVF sont ceux des actes de vente, honoraires payés par le vendeur compris : la valeur obtenue correspond au prix de mise en vente, dont sont déduits les honoraires pour obtenir le prix net vendeur.",
            )}
          </Text>
          {adjustments.length > 0 && (
            <View style={{ marginTop: 4 }}>
              {adjustments.map(([k, v]) => (
                <Text key={k}>{t(`• ${ADJUSTMENT_LABELS[k]} : ${formatPercent(Number(v))}`)}</Text>
              ))}
              <Text style={{ fontFamily: "Helvetica-Bold" }}>{t(`Total des ajustements : ${formatPercent(totalAdj)}`)}</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>À savoir</Text>
          <Text style={[styles.para, styles.small]}>
            {t(
              `Ce document est un avis de valeur établi par votre conseiller immobilier ; il ne constitue pas une expertise. Les données DVF sont publiées avec un délai de plusieurs mois : les ventes les plus récentes peuvent ne pas y figurer. Elles ne couvrent pas l'Alsace, la Moselle ni Mayotte. Source des ventes : ${
                e.data_source ?? "DVF"
              }. Fond de carte : © Contributeurs OpenStreetMap (openstreetmap.org/copyright).`,
            )}
          </Text>
          <Text style={[styles.small, { marginTop: 6 }]}>{t(`Document généré le ${formatDate(data.generatedAt)}.`)}</Text>
        </View>
        <Footer data={data} />
      </Page>
    </Document>
  );
}
