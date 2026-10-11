-- ============================================================================
-- EnergyIT — client/contract document attachments. Business data: owner_id
-- = auth.uid(), no admin bypass, same pattern as clients/contracts. Files
-- live in the private `documents` storage bucket, path
-- {owner_id}/{entity_type}/{entity_id}/{uuid}_{filename}, isolated by the
-- same owner-only rule via storage.objects RLS.
-- ============================================================================

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id),
  entity_type text not null check (entity_type in ('client', 'contract')),
  entity_id uuid not null,
  storage_path text not null unique,
  filename text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create index documents_owner_idx on public.documents (owner_id);
create index documents_entity_idx on public.documents (entity_type, entity_id);

create trigger documents_audit after insert or update or delete on public.documents
  for each row execute function public.log_account_change();

alter table public.documents enable row level security;

create policy documents_owner_all on public.documents
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy documents_storage_select on storage.objects
  for select using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy documents_storage_insert on storage.objects
  for insert with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy documents_storage_delete on storage.objects
  for delete using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
