insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('expense-receipts','expense-receipts',false,512000,array['application/pdf','image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do nothing;
create policy fiexea_receipts_owner_guard on storage.objects as restrictive for all to authenticated
using (bucket_id <> 'expense-receipts' or (storage.foldername(name))[1] = (select auth.uid()::text))
with check (bucket_id <> 'expense-receipts' or (storage.foldername(name))[1] = (select auth.uid()::text));
create policy fiexea_receipts_read on storage.objects for select to authenticated
using (bucket_id = 'expense-receipts' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy fiexea_receipts_insert on storage.objects for insert to authenticated
with check (bucket_id = 'expense-receipts' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy fiexea_receipts_delete on storage.objects for delete to authenticated
using (bucket_id = 'expense-receipts' and (storage.foldername(name))[1] = (select auth.uid()::text));
