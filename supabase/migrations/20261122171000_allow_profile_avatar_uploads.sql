drop policy if exists public_media_avatar_owner_insert on storage.objects;

create policy public_media_avatar_owner_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'public-media'
  and (storage.foldername(name))[1] = 'avatars'
  and (storage.foldername(name))[2] = (select auth.uid())::text
);
