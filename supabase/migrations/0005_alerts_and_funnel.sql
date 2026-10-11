-- ============================================================================
-- EnergyIT — proposal/renewal alerts + sales-funnel state on simulations.
-- `alerts` is business data: owner_id = auth.uid(), no admin bypass, same
-- pattern as clients/contracts/commissions.
-- ============================================================================

alter table public.simulations
  add column estado text not null default 'RASCUNHO' check (estado in ('RASCUNHO', 'ENVIADA', 'CONVERTIDA', 'PERDIDA')),
  add column enviada_em timestamptz;

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id),
  entity_type text not null check (entity_type in ('SIMULATION', 'CONTRACT')),
  entity_id uuid not null,
  tipo text not null check (tipo in ('DIAS_APOS_ENVIO', 'DATA_ESPECIFICA', 'DIAS_ANTES_RENOVACAO')),
  dias int,
  data_alvo date not null,
  lido_em timestamptz,
  created_at timestamptz not null default now()
);

create index alerts_owner_idx on public.alerts (owner_id);
create index alerts_data_alvo_idx on public.alerts (data_alvo);

create trigger alerts_audit after insert or update or delete on public.alerts
  for each row execute function public.log_account_change();

alter table public.alerts enable row level security;

create policy alerts_owner_all on public.alerts
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
