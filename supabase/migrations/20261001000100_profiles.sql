-- =====================================================================
-- Étape 1 : profil de l'agent
-- ---------------------------------------------------------------------
-- Règle de sécurité appliquée à TOUTES les tables de l'application :
--   * chaque ligne porte un user_id (l'agent propriétaire) ;
--   * la sécurité au niveau des lignes (Row Level Security, RLS) est activée ;
--   * une seule règle : un utilisateur connecté ne voit et ne modifie
--     que les lignes dont le user_id est le sien ;
--   * les visiteurs non connectés (rôle « anon ») n'ont aucun accès.
-- =====================================================================

-- Fonction utilitaire : met à jour automatiquement la colonne updated_at.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Profil de l'agent : informations reprises dans le rapport d'estimation PDF.
create table public.profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  email text,
  agency_name text,
  agency_address text,
  logo_path text, -- chemin du logo dans le stockage Supabase (dossier privé de l'agent)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Profil de l''agent (nom, agence, logo) utilisé dans les rapports PDF.';

create trigger profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy "Chaque agent accède uniquement à son profil"
on public.profiles
for all
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

revoke all on public.profiles from anon;
grant select, insert, update, delete on public.profiles to authenticated;

-- Création automatique du profil à l'inscription (nom saisi dans le formulaire + email).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, full_name, email)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.email)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
