-- =====================================================================
-- Étape 3 : biens suivis
--   properties       : fiche bien + mandat en cours
--   property_photos  : photos (fichiers rangés dans le stockage privé « property-photos »)
--   visits           : visites et retours de visite
-- =====================================================================

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  seller_contact_id uuid, -- contact vendeur
  type text not null check (type in ('appartement', 'maison', 'terrain', 'local', 'immeuble', 'parking', 'autre')),
  -- Adresse et position GPS (renseignée par le géocodage IGN, utilisée pour l'estimation DVF)
  address text,
  postal_code text,
  city text,
  citycode text, -- code INSEE de la commune
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  -- Caractéristiques
  surface numeric(8, 2) check (surface > 0),
  rooms smallint check (rooms >= 0),
  bedrooms smallint check (bedrooms >= 0),
  floor smallint,
  has_elevator boolean,
  outdoor text check (outdoor in ('aucun', 'balcon', 'terrasse', 'jardin')),
  parking text check (parking in ('aucun', 'place', 'garage')),
  construction_year smallint check (construction_year between 1000 and 2100),
  dpe text check (dpe in ('A', 'B', 'C', 'D', 'E', 'F', 'G')),
  ges text check (ges in ('A', 'B', 'C', 'D', 'E', 'F', 'G')),
  condition text check (condition in ('neuf', 'tres_bon', 'bon', 'a_rafraichir', 'travaux')),
  price numeric(12, 2) check (price >= 0),
  charges_annual numeric(10, 2) check (charges_annual >= 0), -- charges de copropriété (€/an)
  property_tax numeric(10, 2) check (property_tax >= 0),     -- taxe foncière (€/an)
  description text,
  status text not null default 'estimation'
    check (status in ('estimation', 'en_vente', 'sous_offre', 'sous_compromis', 'vendu', 'retire')),
  -- Mandat en cours
  mandate_type text check (mandate_type in ('simple', 'exclusif', 'semi_exclusif')),
  mandate_start date,
  mandate_end date,
  mandate_fees numeric(12, 2) check (mandate_fees >= 0), -- honoraires TTC (€)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  check (mandate_end is null or mandate_start is null or mandate_end >= mandate_start),
  -- Si le contact vendeur est supprimé, le bien est conservé sans vendeur.
  foreign key (seller_contact_id, user_id)
    references public.contacts (id, user_id) on delete set null (seller_contact_id)
);

comment on table public.properties is 'Biens suivis par l''agent, avec le mandat en cours.';

create index properties_user_status_idx on public.properties (user_id, status);
create index properties_seller_idx on public.properties (seller_contact_id);
create index properties_mandate_end_idx on public.properties (user_id, mandate_end);

create trigger properties_updated_at
before update on public.properties
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Photos
-- ---------------------------------------------------------------------
create table public.property_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  property_id uuid not null,
  storage_path text not null, -- « <user_id>/<property_id>/<fichier>.jpg » dans le stockage property-photos
  position integer not null default 0,
  created_at timestamptz not null default now(),
  foreign key (property_id, user_id) references public.properties (id, user_id) on delete cascade
);

create index property_photos_property_idx on public.property_photos (property_id, position, created_at);

-- ---------------------------------------------------------------------
-- Visites
-- ---------------------------------------------------------------------
create table public.visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  property_id uuid not null,
  buyer_contact_id uuid not null,
  visited_at timestamptz not null,
  rating smallint check (rating between 1 and 5), -- note de l'acquéreur (1 à 5)
  feedback text,                                  -- avis de l'acquéreur
  feedback_sent_at timestamptz,                   -- date de transmission du retour au vendeur
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (property_id, user_id) references public.properties (id, user_id) on delete cascade,
  foreign key (buyer_contact_id, user_id) references public.contacts (id, user_id) on delete cascade
);

comment on table public.visits is 'Visites des biens par les acquéreurs et retours de visite.';

create index visits_property_idx on public.visits (property_id, visited_at desc);
create index visits_buyer_idx on public.visits (buyer_contact_id, visited_at desc);
create index visits_user_date_idx on public.visits (user_id, visited_at);

create trigger visits_updated_at
before update on public.visits
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Sécurité des tables
-- ---------------------------------------------------------------------
alter table public.properties enable row level security;
alter table public.property_photos enable row level security;
alter table public.visits enable row level security;

create policy "Chaque agent accède uniquement à ses biens"
on public.properties for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "Chaque agent accède uniquement à ses photos"
on public.property_photos for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "Chaque agent accède uniquement à ses visites"
on public.visits for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

revoke all on public.properties, public.property_photos, public.visits from anon;
grant select, insert, update, delete on public.properties, public.property_photos, public.visits to authenticated;

-- ---------------------------------------------------------------------
-- Stockage des photos : espace privé, un dossier par agent
-- Chemin des fichiers : <user_id>/<property_id>/<nom>.jpg
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('property-photos', 'property-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Photos : lecture de son propre dossier"
on storage.objects for select to authenticated
using (bucket_id = 'property-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Photos : ajout dans son propre dossier"
on storage.objects for insert to authenticated
with check (bucket_id = 'property-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Photos : modification dans son propre dossier"
on storage.objects for update to authenticated
using (bucket_id = 'property-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Photos : suppression dans son propre dossier"
on storage.objects for delete to authenticated
using (bucket_id = 'property-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
