-- =====================================================================
-- Étape 6 : estimations basées sur DVF
-- ---------------------------------------------------------------------
-- Chaque estimation conserve une COPIE FIGÉE des ventes comparables
-- (y compris celles exclues par l'agent) : l'historique et les rapports PDF
-- restent identiques même si les données DVF évoluent ou deviennent indisponibles.
-- =====================================================================

create table public.estimations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  property_id uuid, -- bien suivi concerné (facultatif : une estimation peut être faite sans fiche bien)

  -- Bien estimé (copie des caractéristiques au moment de l'estimation)
  property_type text not null check (property_type in ('appartement', 'maison')),
  address text,
  postal_code text,
  city text,
  citycode text,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  surface numeric(8, 2) not null check (surface > 0),
  rooms smallint check (rooms >= 0),

  -- Paramètres de recherche des comparables
  radius_m integer not null default 500 check (radius_m between 100 and 5000),
  period_years smallint not null default 3 check (period_years between 1 and 10),
  surface_tolerance_pct smallint not null default 20 check (surface_tolerance_pct between 5 and 100),
  data_source text, -- ex. « DVF+ open data (Cerema) »

  -- Comparables (copie figée) : [{ id, date, type, price, surface, rooms, latitude, longitude, distance, pricePerSqm, excluded, outlier, … }]
  comparables jsonb not null default '[]'::jsonb,

  -- Ajustements en % : { dpe, etage, exterieur, etat, travaux }
  adjustments jsonb not null default '{}'::jsonb,

  -- Résultat
  comparables_count integer not null default 0,
  median_price_sqm numeric(10, 2),
  low_value numeric(12, 2),
  mid_value numeric(12, 2),
  high_value numeric(12, 2),
  recommended_price numeric(12, 2),
  fees_mode text not null default 'pourcentage' check (fees_mode in ('pourcentage', 'montant')),
  fees_value numeric(12, 2) not null default 0 check (fees_value >= 0),
  fees_charged_to text not null default 'vendeur' check (fees_charged_to in ('vendeur', 'acquereur')),
  fees_amount numeric(12, 2),
  net_seller_price numeric(12, 2),
  arguments text, -- argumentaire de l'agent (repris dans le rapport PDF)

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Si le bien est supprimé, l'estimation est conservée (sans lien).
  foreign key (property_id, user_id) references public.properties (id, user_id) on delete set null (property_id)
);

comment on table public.estimations is 'Estimations DVF : bien estimé, comparables figés, ajustements et résultat.';

create index estimations_user_date_idx on public.estimations (user_id, created_at desc);
create index estimations_property_idx on public.estimations (property_id, created_at desc);

create trigger estimations_updated_at
before update on public.estimations
for each row execute function public.set_updated_at();

alter table public.estimations enable row level security;

create policy "Chaque agent accède uniquement à ses estimations"
on public.estimations for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

revoke all on public.estimations from anon;
grant select, insert, update, delete on public.estimations to authenticated;
