-- =====================================================================
-- Étape 4 : rapprochement biens / acquéreurs
-- ---------------------------------------------------------------------
-- Le score est calculé dans la base, automatiquement, à chaque création
-- ou modification d'un bien, d'un profil acquéreur ou d'un contact.
-- Les correspondances sont enregistrées dans la table « matches » ;
-- une correspondance dont « seen_at » est vide est « nouvelle »
-- (elle déclenche la notification dans l'application).
--
-- Règles du score (sur 100) :
--   Critères éliminatoires :
--     - type de bien parmi ceux recherchés (si renseignés) ;
--     - ville ou code postal parmi ceux recherchés (si renseignés) ;
--     - prix au plus 10 % au-dessus du budget maximum.
--   Pénalités :
--     - prix au-dessus du budget : jusqu'à −25 points (à +10 %) ;
--     - surface sous le minimum : −2 points par % manquant (max −40) ;
--     - pièces sous le minimum : −15 points par pièce manquante ;
--     - critère indispensable absent : −20 points chacun.
--   Seules les correspondances d'au moins 50 points sont conservées.
--   Biens concernés : statut « estimation » ou « en vente ».
--   Acquéreurs concernés : rôle acquéreur, étape autre que « acheté » / « perdu ».
-- =====================================================================

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  property_id uuid not null,
  buyer_contact_id uuid not null,
  score smallint not null check (score between 0 and 100),
  -- Détail des critères : [{ "key": "prix", "ok": true, "value": 295000, "target": 300000 }, …]
  details jsonb not null default '[]'::jsonb,
  seen_at timestamptz, -- vide = nouvelle correspondance
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (property_id, buyer_contact_id),
  foreign key (property_id, user_id) references public.properties (id, user_id) on delete cascade,
  foreign key (buyer_contact_id, user_id) references public.contacts (id, user_id) on delete cascade
);

comment on table public.matches is 'Correspondances biens / acquéreurs calculées automatiquement.';

create index matches_user_new_idx on public.matches (user_id, seen_at);
create index matches_buyer_idx on public.matches (buyer_contact_id, score desc);

alter table public.matches enable row level security;

create policy "Chaque agent accède uniquement à ses correspondances"
on public.matches for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

revoke all on public.matches from anon;
grant select, insert, update, delete on public.matches to authenticated;

-- ---------------------------------------------------------------------
-- Score d'un bien pour un acquéreur.
-- Renvoie { "score": 0-100, "details": [...] } ou NULL si incompatible.
-- ---------------------------------------------------------------------
create or replace function public.match_property_buyer(p public.properties, b public.buyer_profiles)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  details jsonb := '[]'::jsonb;
  penalty numeric := 0;
  ratio numeric;
  ok boolean;
  must_have text;
begin
  -- Type de bien (éliminatoire)
  if cardinality(b.property_types) > 0 then
    if not (p.type = any (b.property_types)) then
      return null;
    end if;
    details := details || jsonb_build_object('key', 'type', 'ok', true, 'value', p.type);
  end if;

  -- Secteur : ville ou code postal (éliminatoire), comparaison sans accents ni majuscules
  if cardinality(b.locations) > 0 then
    if not exists (
      select 1
      from unnest(b.locations) as loc
      where public.f_unaccent(lower(trim(loc))) in (
        public.f_unaccent(lower(coalesce(p.city, ''))),
        lower(coalesce(p.postal_code, ''))
      )
    ) then
      return null;
    end if;
    details := details || jsonb_build_object('key', 'secteur', 'ok', true, 'value', coalesce(p.city, p.postal_code));
  end if;

  -- Prix / budget
  if coalesce(b.budget_max, 0) > 0 then
    if p.price is null then
      details := details || jsonb_build_object('key', 'prix', 'ok', null, 'target', b.budget_max);
    elsif p.price > b.budget_max * 1.10 then
      return null;
    elsif p.price > b.budget_max then
      ratio := p.price / b.budget_max - 1; -- entre 0 et 10 %
      penalty := penalty + round(ratio / 0.10 * 25);
      details := details || jsonb_build_object('key', 'prix', 'ok', false, 'value', p.price, 'target', b.budget_max);
    else
      details := details || jsonb_build_object('key', 'prix', 'ok', true, 'value', p.price, 'target', b.budget_max);
    end if;
  end if;

  -- Surface minimum
  if coalesce(b.min_surface, 0) > 0 then
    if p.surface is null then
      details := details || jsonb_build_object('key', 'surface', 'ok', null, 'target', b.min_surface);
    elsif p.surface >= b.min_surface then
      details := details || jsonb_build_object('key', 'surface', 'ok', true, 'value', p.surface, 'target', b.min_surface);
    else
      ratio := (b.min_surface - p.surface) / b.min_surface;
      penalty := penalty + least(40, round(ratio * 200));
      details := details || jsonb_build_object('key', 'surface', 'ok', false, 'value', p.surface, 'target', b.min_surface);
    end if;
  end if;

  -- Nombre de pièces minimum
  if coalesce(b.min_rooms, 0) > 0 then
    if p.rooms is null then
      details := details || jsonb_build_object('key', 'pieces', 'ok', null, 'target', b.min_rooms);
    elsif p.rooms >= b.min_rooms then
      details := details || jsonb_build_object('key', 'pieces', 'ok', true, 'value', p.rooms, 'target', b.min_rooms);
    else
      penalty := penalty + 15 * (b.min_rooms - p.rooms);
      details := details || jsonb_build_object('key', 'pieces', 'ok', false, 'value', p.rooms, 'target', b.min_rooms);
    end if;
  end if;

  -- Critères indispensables (une valeur non renseignée compte comme absente)
  foreach must_have in array b.must_haves loop
    ok := case must_have
      when 'exterieur' then p.outdoor in ('balcon', 'terrasse', 'jardin')
      when 'jardin' then p.outdoor = 'jardin'
      when 'parking' then p.parking in ('place', 'garage')
      -- Pas besoin d'ascenseur au rez-de-chaussée ni dans une maison
      when 'ascenseur' then p.has_elevator or p.floor = 0 or p.type = 'maison'
      else false
    end;
    ok := coalesce(ok, false);
    if not ok then
      penalty := penalty + 20;
    end if;
    details := details || jsonb_build_object('key', must_have, 'ok', ok);
  end loop;

  return jsonb_build_object('score', greatest(0, 100 - penalty)::int, 'details', details);
end;
$$;

-- ---------------------------------------------------------------------
-- Mise à jour des correspondances d'un bien (tous les acquéreurs de l'agent)
-- ---------------------------------------------------------------------
create or replace function public.refresh_matches_for_property(target_property_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  prop public.properties;
begin
  select * into prop from public.properties where id = target_property_id;
  if not found then
    return;
  end if;

  if prop.status not in ('estimation', 'en_vente') then
    delete from public.matches where property_id = target_property_id;
    return;
  end if;

  with candidates as (
    select b.contact_id, public.match_property_buyer(prop, b) as m
    from public.buyer_profiles b
    join public.contacts c on c.id = b.contact_id
    where b.user_id = prop.user_id
      and 'acquereur' = any (c.roles)
      and coalesce(c.buyer_stage, 'nouveau') not in ('achete', 'perdu')
  ),
  kept as (
    select contact_id, (m ->> 'score')::smallint as score, m -> 'details' as details
    from candidates
    where m is not null and (m ->> 'score')::int >= 50
  ),
  removed as (
    delete from public.matches mt
    where mt.property_id = target_property_id
      and not exists (select 1 from kept k where k.contact_id = mt.buyer_contact_id)
  )
  insert into public.matches (user_id, property_id, buyer_contact_id, score, details)
  select prop.user_id, target_property_id, k.contact_id, k.score, k.details
  from kept k
  on conflict (property_id, buyer_contact_id)
  do update set score = excluded.score, details = excluded.details, updated_at = now();
end;
$$;

-- ---------------------------------------------------------------------
-- Mise à jour des correspondances d'un acquéreur (tous les biens de l'agent)
-- ---------------------------------------------------------------------
create or replace function public.refresh_matches_for_buyer(target_contact_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  buyer public.buyer_profiles;
  contact public.contacts;
begin
  select * into contact from public.contacts where id = target_contact_id;
  select * into buyer from public.buyer_profiles where contact_id = target_contact_id;

  if contact.id is null or buyer.contact_id is null
     or not ('acquereur' = any (contact.roles))
     or coalesce(contact.buyer_stage, 'nouveau') in ('achete', 'perdu') then
    delete from public.matches where buyer_contact_id = target_contact_id;
    return;
  end if;

  with candidates as (
    select p.id as property_id, public.match_property_buyer(p, buyer) as m
    from public.properties p
    where p.user_id = buyer.user_id
      and p.status in ('estimation', 'en_vente')
  ),
  kept as (
    select property_id, (m ->> 'score')::smallint as score, m -> 'details' as details
    from candidates
    where m is not null and (m ->> 'score')::int >= 50
  ),
  removed as (
    delete from public.matches mt
    where mt.buyer_contact_id = target_contact_id
      and not exists (select 1 from kept k where k.property_id = mt.property_id)
  )
  insert into public.matches (user_id, property_id, buyer_contact_id, score, details)
  select buyer.user_id, k.property_id, target_contact_id, k.score, k.details
  from kept k
  on conflict (property_id, buyer_contact_id)
  do update set score = excluded.score, details = excluded.details, updated_at = now();
end;
$$;

-- ---------------------------------------------------------------------
-- Déclencheurs : recalcul automatique
-- ---------------------------------------------------------------------
create or replace function public.properties_refresh_matches()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform public.refresh_matches_for_property(new.id);
  return null;
end;
$$;

create trigger properties_matches
after insert or update of type, city, postal_code, price, surface, rooms, floor, has_elevator, outdoor, parking, status
on public.properties
for each row execute function public.properties_refresh_matches();

create or replace function public.buyer_profiles_refresh_matches()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform public.refresh_matches_for_buyer(new.contact_id);
  return null;
end;
$$;

create trigger buyer_profiles_matches
after insert or update on public.buyer_profiles
for each row execute function public.buyer_profiles_refresh_matches();

create or replace function public.contacts_refresh_matches()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform public.refresh_matches_for_buyer(new.id);
  return null;
end;
$$;

create trigger contacts_matches
after update of roles, buyer_stage on public.contacts
for each row
when (old.roles is distinct from new.roles or old.buyer_stage is distinct from new.buyer_stage)
execute function public.contacts_refresh_matches();

-- Les fonctions s'exécutent avec les droits de l'agent connecté : les règles RLS
-- s'appliquent donc aussi aux recalculs (un agent ne voit jamais les biens d'un autre).
revoke execute on function public.match_property_buyer(public.properties, public.buyer_profiles) from anon, public;
revoke execute on function public.refresh_matches_for_property(uuid) from anon, public;
revoke execute on function public.refresh_matches_for_buyer(uuid) from anon, public;
grant execute on function public.match_property_buyer(public.properties, public.buyer_profiles) to authenticated;
grant execute on function public.refresh_matches_for_property(uuid) to authenticated;
grant execute on function public.refresh_matches_for_buyer(uuid) to authenticated;

-- Calcul initial pour les données déjà présentes.
select public.refresh_matches_for_property(id) from public.properties;
