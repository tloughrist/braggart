-- 0008: avatar uploads.
-- A public "avatars" storage bucket with owner-scoped write policies, plus RLS
-- on public.assets so a player can record their avatar (players.avatar_asset_id
-- already references assets).
--
-- Note: on hosted Supabase, storage.objects is owned by supabase_storage_admin,
-- so these storage policies may need to be applied via the dashboard if a
-- migration lacks permission. Locally (postgres superuser) they apply fine.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880,
        array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- storage.objects: public read; a user may write only within their own <uid>/ folder.
create policy "avatars read" on storage.objects
  for select using (bucket_id = 'avatars');
create policy "avatars insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars update" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- public.assets: owner writes; readable by any authenticated user (avatars are
-- shown for other players too).
create policy assets_select on assets for select to authenticated using (true);
create policy assets_insert on assets for insert to authenticated
  with check (owner_id = auth.uid());
create policy assets_update on assets for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy assets_delete on assets for delete to authenticated
  using (owner_id = auth.uid());
