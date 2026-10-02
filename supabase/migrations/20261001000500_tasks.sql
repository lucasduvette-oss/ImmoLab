-- =====================================================================
-- Étape 5 : tâches et relances
--   tasks               : tâches avec échéance, liées à un contact et/ou un bien
--   buyer_last_contact  : vue « date du dernier contact » de chaque acquéreur actif,
--                         utilisée pour suggérer une relance après 30 jours sans contact
-- Les relances suggérées ne sont pas stockées : elles sont calculées à l'affichage.
-- Une relance transformée en tâche garde sa « clé » (suggestion_key) et n'est plus proposée.
-- =====================================================================

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  notes text,
  due_date date not null,
  contact_id uuid,
  property_id uuid,
  done_at timestamptz,          -- vide = tâche à faire
  suggestion_key text,          -- relance suggérée à l'origine de la tâche
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Si le contact ou le bien est supprimé, la tâche est conservée sans ce lien.
  foreign key (contact_id, user_id) references public.contacts (id, user_id) on delete set null (contact_id),
  foreign key (property_id, user_id) references public.properties (id, user_id) on delete set null (property_id)
);

comment on table public.tasks is 'Tâches et relances de l''agent.';

create index tasks_user_due_idx on public.tasks (user_id, done_at, due_date);
create index tasks_contact_idx on public.tasks (contact_id);
create index tasks_property_idx on public.tasks (property_id);
-- Une relance suggérée ne peut être transformée qu'une seule fois en tâche.
create unique index tasks_suggestion_key_unique on public.tasks (user_id, suggestion_key) where suggestion_key is not null;

create trigger tasks_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

alter table public.tasks enable row level security;

create policy "Chaque agent accède uniquement à ses tâches"
on public.tasks for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

revoke all on public.tasks from anon;
grant select, insert, update, delete on public.tasks to authenticated;

-- ---------------------------------------------------------------------
-- Date du dernier contact des acquéreurs actifs (ni « acheté » ni « perdu »).
-- Dernier contact = le plus récent parmi : échange passé, visite passée, tâche liée
-- au contact cochée comme faite (à défaut : date de création du contact).
-- security_invoker : la vue applique les règles RLS de l'utilisateur qui l'interroge.
-- ---------------------------------------------------------------------
create view public.buyer_last_contact
with (security_invoker = true)
as
select
  c.id as contact_id,
  c.user_id,
  c.first_name,
  c.last_name,
  c.phone,
  greatest(
    c.created_at,
    (select max(i.occurred_at) from public.interactions i where i.contact_id = c.id and i.occurred_at <= now()),
    (select max(v.visited_at) from public.visits v where v.buyer_contact_id = c.id and v.visited_at <= now()),
    (select max(t.done_at) from public.tasks t where t.contact_id = c.id and t.done_at <= now())
  ) as last_contact_at
from public.contacts c
where 'acquereur' = any (c.roles)
  and coalesce(c.buyer_stage, 'nouveau') not in ('achete', 'perdu');

-- Vue en lecture seule.
revoke all on public.buyer_last_contact from anon, authenticated;
grant select on public.buyer_last_contact to authenticated;
