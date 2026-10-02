-- =====================================================================
-- Étape 7 : logo de l'agence (repris dans le rapport d'estimation PDF)
-- Stockage privé « agent-logos » : un dossier par agent (<user_id>/logo-….png).
-- Le chemin du fichier est enregistré dans profiles.logo_path.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('agent-logos', 'agent-logos', false, 2097152, array['image/png', 'image/jpeg'])
on conflict (id) do nothing;

create policy "Logos : lecture de son propre dossier"
on storage.objects for select to authenticated
using (bucket_id = 'agent-logos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Logos : ajout dans son propre dossier"
on storage.objects for insert to authenticated
with check (bucket_id = 'agent-logos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Logos : modification dans son propre dossier"
on storage.objects for update to authenticated
using (bucket_id = 'agent-logos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Logos : suppression dans son propre dossier"
on storage.objects for delete to authenticated
using (bucket_id = 'agent-logos' and (storage.foldername(name))[1] = (select auth.uid())::text);
