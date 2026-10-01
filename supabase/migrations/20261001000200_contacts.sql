-- =====================================================================
-- Étape 2 : fichier clients
--   contacts        : fiche contact, rôles, source, étapes des pipelines
--   buyer_profiles  : qualification et critères de recherche d'un acquéreur
--   interactions    : timeline des échanges (appel, SMS, mail, rendez-vous, visite, note)
-- Les listes de valeurs sont contrôlées par des contraintes « check ».
-- =====================================================================

-- Recherche insensible aux accents (« Hélène » = « helene »).
create extension if not exists unaccent with schema extensions;

create or replace function public.f_unaccent(value text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, value)
$$;

-- ---------------------------------------------------------------------
-- Contacts
-- ---------------------------------------------------------------------
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  first_name text,
  last_name text not null check (length(trim(last_name)) > 0),
  phone text,
  email text,
  address text,
  postal_code text,
  city text,
  source text check (source in ('pige', 'recommandation', 'boitage', 'portail', 'autre')),
  notes text,
  -- Un contact peut avoir plusieurs rôles.
  roles text[] not null default '{}'
    check (roles <@ array['vendeur', 'acquereur', 'prospect', 'partenaire']),
  partner_type text check (partner_type in ('notaire', 'courtier', 'diagnostiqueur', 'artisan', 'autre')),
  -- Étapes des pipelines (renseignées automatiquement selon les rôles, voir déclencheur ci-dessous).
  seller_stage text check (seller_stage in ('prospect', 'estimation', 'mandat', 'vendu', 'perdu')),
  buyer_stage text check (buyer_stage in ('nouveau', 'qualifie', 'en_visite', 'offre', 'achete', 'perdu')),
  -- Texte de recherche (nom, email, ville, CP, téléphone) sans accents ni majuscules.
  search_text text generated always as (
    public.f_unaccent(lower(
      coalesce(first_name, '') || ' ' || last_name || ' ' || coalesce(email, '') || ' ' ||
      coalesce(city, '') || ' ' || coalesce(postal_code, '') || ' ' ||
      coalesce(regexp_replace(phone, '\D', '', 'g'), '')
    ))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Permet aux autres tables de référencer (id, user_id) : un lien ne peut viser qu'un contact du même agent.
  unique (id, user_id)
);

comment on table public.contacts is 'Fichier clients de l''agent : vendeurs, acquéreurs, prospects, partenaires.';

create index contacts_user_name_idx on public.contacts (user_id, last_name, first_name);
create index contacts_roles_idx on public.contacts using gin (roles);

-- Étapes par défaut : un vendeur démarre en « prospect », un acquéreur en « nouveau ».
-- Si le rôle est retiré, l'étape correspondante est effacée.
create or replace function public.contacts_set_stages()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if 'vendeur' = any (new.roles) then
    new.seller_stage := coalesce(new.seller_stage, 'prospect');
  else
    new.seller_stage := null;
  end if;
  if 'acquereur' = any (new.roles) then
    new.buyer_stage := coalesce(new.buyer_stage, 'nouveau');
  else
    new.buyer_stage := null;
  end if;
  if not ('partenaire' = any (new.roles)) then
    new.partner_type := null;
  end if;
  return new;
end;
$$;

create trigger contacts_stages
before insert or update on public.contacts
for each row execute function public.contacts_set_stages();

create trigger contacts_updated_at
before update on public.contacts
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Profil acquéreur : qualification + critères de recherche (1 par contact)
-- ---------------------------------------------------------------------
create table public.buyer_profiles (
  contact_id uuid primary key,
  user_id uuid not null default auth.uid(),
  -- Qualification
  budget_max numeric(12, 2) check (budget_max >= 0),
  financing_approved boolean,            -- accord de principe de la banque
  down_payment numeric(12, 2) check (down_payment >= 0),  -- apport
  timeframe text check (timeframe in ('immediat', '3_mois', '6_mois', 'plus_6_mois')),
  needs_prior_sale boolean,              -- doit vendre avant d'acheter
  motivation smallint check (motivation between 1 and 5),
  -- Critères de recherche
  property_types text[] not null default '{}'
    check (property_types <@ array['appartement', 'maison', 'terrain', 'local', 'immeuble', 'parking', 'autre']),
  locations text[] not null default '{}', -- villes ou codes postaux
  min_surface numeric(8, 2) check (min_surface >= 0),
  min_rooms smallint check (min_rooms >= 0),
  must_haves text[] not null default '{}'
    check (must_haves <@ array['exterieur', 'jardin', 'parking', 'ascenseur']),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (contact_id, user_id) references public.contacts (id, user_id) on delete cascade
);

comment on table public.buyer_profiles is 'Qualification et critères de recherche des acquéreurs.';

create trigger buyer_profiles_updated_at
before update on public.buyer_profiles
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Timeline des échanges
-- ---------------------------------------------------------------------
create table public.interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  contact_id uuid not null,
  kind text not null check (kind in ('appel', 'sms', 'email', 'rdv', 'visite', 'note')),
  occurred_at timestamptz not null default now(), -- peut être dans le futur pour un rendez-vous planifié
  content text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (contact_id, user_id) references public.contacts (id, user_id) on delete cascade
);

comment on table public.interactions is 'Timeline des échanges avec les contacts (et rendez-vous planifiés).';

create index interactions_contact_idx on public.interactions (contact_id, occurred_at desc);
create index interactions_user_date_idx on public.interactions (user_id, occurred_at);

create trigger interactions_updated_at
before update on public.interactions
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Sécurité : chaque agent n'accède qu'à ses propres lignes
-- ---------------------------------------------------------------------
alter table public.contacts enable row level security;
alter table public.buyer_profiles enable row level security;
alter table public.interactions enable row level security;

create policy "Chaque agent accède uniquement à ses contacts"
on public.contacts for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "Chaque agent accède uniquement à ses profils acquéreurs"
on public.buyer_profiles for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "Chaque agent accède uniquement à ses échanges"
on public.interactions for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

revoke all on public.contacts, public.buyer_profiles, public.interactions from anon;
grant select, insert, update, delete on public.contacts, public.buyer_profiles, public.interactions to authenticated;
