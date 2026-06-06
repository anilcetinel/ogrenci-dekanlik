-- Öğrenci Destek Koordinatörlüğü dosya arşivi için Supabase Storage kurulumu
-- Supabase SQL Editor içinde bir kez çalıştırın.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'dekanlik-files',
  'dekanlik-files',
  true,
  10485760,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/plain',
    'text/csv',
    'application/octet-stream'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "dekanlik_files_read" on storage.objects;
create policy "dekanlik_files_read"
on storage.objects for select
to anon
using (bucket_id = 'dekanlik-files');

drop policy if exists "dekanlik_files_insert" on storage.objects;
create policy "dekanlik_files_insert"
on storage.objects for insert
to anon
with check (bucket_id = 'dekanlik-files');

drop policy if exists "dekanlik_files_update" on storage.objects;
create policy "dekanlik_files_update"
on storage.objects for update
to anon
using (bucket_id = 'dekanlik-files')
with check (bucket_id = 'dekanlik-files');

drop policy if exists "dekanlik_files_delete" on storage.objects;
create policy "dekanlik_files_delete"
on storage.objects for delete
to anon
using (bucket_id = 'dekanlik-files');
