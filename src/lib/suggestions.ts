import type { SupabaseClient } from "@supabase/supabase-js";

import { MANDATE_ALERT_DAYS } from "./constants";
import { addDaysISO, daysBetween, formatDate, fullName, todayISO } from "./format";
import { propertyTitle } from "./property";
import type { Contact, Property, Visit } from "./types";

/**
 * Relances suggérées automatiquement :
 *  1. acquéreur sans contact depuis 30 jours ;
 *  2. mandat qui arrive à échéance (30 jours) ;
 *  3. retour de visite : demander son avis à l'acquéreur, puis transmettre le retour au vendeur.
 *
 * Elles ne sont pas enregistrées : elles disparaissent d'elles-mêmes quand la situation est réglée
 * (échange saisi, mandat prolongé, retour saisi ou transmis…) ou quand elles ont été transformées en tâche.
 */
export type Suggestion = {
  key: string; // identifiant stable (évite de proposer deux fois la même relance)
  kind: "relance-acquereur" | "mandat" | "avis-visite" | "retour-vendeur";
  title: string;
  description: string; // texte affiché (peut contenir une durée relative)
  taskNotes: string; // notes de la tâche créée à partir de la relance (dates absolues, ne se périment pas)
  contactId: string | null;
  propertyId: string | null;
  href: string; // page où traiter la relance
};

/** Nombre de jours sans contact au-delà duquel un acquéreur est à relancer. */
export const BUYER_FOLLOW_UP_DAYS = 30;
/** Les visites plus anciennes ne génèrent plus de relance. */
const VISIT_WINDOW_DAYS = 60;

type BuyerRow = { contact_id: string; first_name: string | null; last_name: string; last_contact_at: string };
type MandateRow = Pick<Property, "id" | "type" | "rooms" | "surface" | "city" | "mandate_end"> & {
  seller: Pick<Contact, "id" | "first_name" | "last_name"> | null;
};
type VisitRow = Pick<Visit, "id" | "visited_at" | "rating" | "feedback"> & {
  buyer: Pick<Contact, "id" | "first_name" | "last_name"> | null;
  property:
    | (Pick<Property, "id" | "type" | "rooms" | "surface" | "city"> & { seller: Pick<Contact, "id" | "first_name" | "last_name"> | null })
    | null;
};

export async function getSuggestions(supabase: SupabaseClient, now = new Date()): Promise<Suggestion[]> {
  const today = todayISO(now);
  const followUpLimit = new Date(now.getTime() - BUYER_FOLLOW_UP_DAYS * 86_400_000).toISOString();
  const visitLimit = new Date(now.getTime() - VISIT_WINDOW_DAYS * 86_400_000).toISOString();

  const [buyers, mandates, visits] = await Promise.all([
    supabase.from("buyer_last_contact").select("contact_id, first_name, last_name, last_contact_at").lt("last_contact_at", followUpLimit).returns<BuyerRow[]>(),
    supabase
      .from("properties")
      .select("id, type, rooms, surface, city, mandate_end, seller:contacts(id, first_name, last_name)")
      .lte("mandate_end", addDaysISO(today, MANDATE_ALERT_DAYS))
      .in("status", ["estimation", "en_vente", "sous_offre"])
      .returns<MandateRow[]>(),
    supabase
      .from("visits")
      .select(
        "id, visited_at, rating, feedback, buyer:contacts(id, first_name, last_name), " +
          "property:properties(id, type, rooms, surface, city, seller:contacts(id, first_name, last_name))",
      )
      .is("feedback_sent_at", null)
      .lte("visited_at", now.toISOString())
      .gte("visited_at", visitLimit)
      .returns<VisitRow[]>(),
  ]);

  const list: Suggestion[] = [];

  for (const b of buyers.data ?? []) {
    // Date du dernier contact à l'heure de Paris (la base renvoie l'heure UTC).
    const lastContact = todayISO(new Date(b.last_contact_at));
    const days = daysBetween(lastContact, today);
    list.push({
      key: `relance-acquereur:${b.contact_id}:${lastContact}`,
      kind: "relance-acquereur",
      title: `Relancer ${fullName(b)}`,
      description: `Acquéreur sans contact depuis ${days} jours.`,
      taskNotes: `Dernier contact le ${formatDate(lastContact)}.`,
      contactId: b.contact_id,
      propertyId: null,
      href: `/contacts/${b.contact_id}`,
    });
  }

  for (const p of mandates.data ?? []) {
    const days = daysBetween(today, p.mandate_end!);
    const when = days < 0 ? `a expiré le ${formatDate(p.mandate_end)}` : `arrive à échéance le ${formatDate(p.mandate_end)}`;
    list.push({
      key: `mandat:${p.id}:${p.mandate_end}`,
      kind: "mandat",
      title: p.seller ? `Renouvellement du mandat avec ${fullName(p.seller)}` : "Renouvellement du mandat",
      description: `Le mandat « ${propertyTitle(p)} » ${when}.`,
      taskNotes: `Le mandat « ${propertyTitle(p)} » ${when}.`,
      contactId: p.seller?.id ?? null,
      propertyId: p.id,
      href: `/biens/${p.id}`,
    });
  }

  for (const v of visits.data ?? []) {
    if (!v.property) continue;
    const label = `${propertyTitle(v.property)}, visite du ${formatDate(v.visited_at)}`;
    if (!v.rating && !v.feedback) {
      list.push({
        key: `avis-visite:${v.id}`,
        kind: "avis-visite",
        title: v.buyer ? `Demander son avis à ${fullName(v.buyer)}` : "Recueillir le retour de visite",
        description: `${label}.`,
        taskNotes: `${label}.`,
        contactId: v.buyer?.id ?? null,
        propertyId: v.property.id,
        href: `/biens/${v.property.id}`,
      });
    } else {
      list.push({
        key: `retour-vendeur:${v.id}`,
        kind: "retour-vendeur",
        title: v.property.seller ? `Transmettre le retour de visite à ${fullName(v.property.seller)}` : "Transmettre le retour de visite au vendeur",
        description: `${label}${v.buyer ? ` (${fullName(v.buyer)})` : ""}.`,
        taskNotes: `${label}${v.buyer ? ` (${fullName(v.buyer)})` : ""}.`,
        contactId: v.property.seller?.id ?? null,
        propertyId: v.property.id,
        href: `/biens/${v.property.id}`,
      });
    }
  }

  // Relances déjà transformées en tâche : on ne cherche que les clés des relances candidates
  // (requête bornée, quel que soit le nombre de tâches accumulées).
  const usedKeys = new Set<string>();
  const keys = list.map((s) => s.key);
  for (let i = 0; i < keys.length; i += 100) {
    const { data } = await supabase.from("tasks").select("suggestion_key").in("suggestion_key", keys.slice(i, i + 100));
    for (const t of data ?? []) usedKeys.add(t.suggestion_key as string);
  }
  return list.filter((s) => !usedKeys.has(s.key));
}
