import type { SupabaseClient } from "@supabase/supabase-js";

import { addDaysISO, todayISO } from "@/lib/format";
import type { Contact, Property, Task } from "@/lib/types";

export type TaskWithLinks = Task & {
  contact: Pick<Contact, "id" | "first_name" | "last_name" | "phone"> | null;
  property: Pick<Property, "id" | "type" | "rooms" | "surface" | "city"> | null;
};

const SELECT = "*, contact:contacts(id, first_name, last_name, phone), property:properties(id, type, rooms, surface, city)";

/** Tâches à faire (toutes échéances), de la plus ancienne échéance à la plus lointaine. */
export async function listOpenTasks(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("tasks")
    .select(SELECT)
    .is("done_at", null)
    .order("due_date")
    .order("created_at")
    .returns<TaskWithLinks[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Tâches terminées ces 30 derniers jours. */
export async function listRecentDoneTasks(supabase: SupabaseClient) {
  const since = `${addDaysISO(todayISO(), -30)}T00:00:00Z`;
  const { data } = await supabase
    .from("tasks")
    .select(SELECT)
    .not("done_at", "is", null)
    .gte("done_at", since)
    .order("done_at", { ascending: false })
    .returns<TaskWithLinks[]>();
  return data ?? [];
}

/** Tâches liées à un contact ou à un bien : toutes celles à faire, puis les 20 dernières terminées. */
export async function tasksFor(supabase: SupabaseClient, link: { contactId?: string; propertyId?: string }) {
  const base = () => {
    let query = supabase.from("tasks").select(SELECT);
    if (link.contactId) query = query.eq("contact_id", link.contactId);
    if (link.propertyId) query = query.eq("property_id", link.propertyId);
    return query;
  };
  const [open, done] = await Promise.all([
    base().is("done_at", null).order("due_date").limit(200).returns<TaskWithLinks[]>(),
    base().not("done_at", "is", null).order("done_at", { ascending: false }).limit(20).returns<TaskWithLinks[]>(),
  ]);
  return [...(open.data ?? []), ...(done.data ?? [])];
}

/** Répartit les tâches à faire : en retard / aujourd'hui / à venir. */
export function splitTasks<T extends Pick<Task, "due_date">>(tasks: T[], today = todayISO()) {
  return {
    overdue: tasks.filter((t) => t.due_date < today),
    today: tasks.filter((t) => t.due_date === today),
    upcoming: tasks.filter((t) => t.due_date > today),
  };
}
