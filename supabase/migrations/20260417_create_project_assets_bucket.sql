-- Create the project-assets bucket that storage.ts uploads to.
-- Public so image URLs can be rendered from <img src> without signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-assets',
  'project-assets',
  true,
  20971520,
  array['image/png','image/jpeg','image/jpg','image/webp','image/gif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "project_assets_read_own" on storage.objects;
drop policy if exists "project_assets_insert_own" on storage.objects;
drop policy if exists "project_assets_update_own" on storage.objects;
drop policy if exists "project_assets_delete_own" on storage.objects;
drop policy if exists "project_assets_public_read" on storage.objects;

create policy "project_assets_public_read"
  on storage.objects for select
  using (bucket_id = 'project-assets');

create policy "project_assets_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'project-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "project_assets_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'project-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "project_assets_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'project-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
