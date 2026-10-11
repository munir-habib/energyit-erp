-- Grupos — várias Empresas (clients) agrupadas para efeitos de documento consolidado (ver
-- docs/redesign-linhas-comparacao.md, ponto 5.c: "Compor documento" por Grupo inteiro, deixado
-- pendente na altura por depender exatamente desta tabela). Um cliente pertence a, no máximo, 1 Grupo
-- (grupo_id nullable — a maioria dos clientes fica sem Grupo, como cliente individual).
--
-- NOTA: este ficheiro ainda NÃO foi aplicado ao projeto Supabase (a ligação MCP continua sem
-- autorização) — aplicar com mcp__supabase__apply_migration assim que for reautorizada, antes de usar
-- GruposListPage/GroupDetailPage ou o campo "Grupo" no formulário de cliente.
create table public.grupos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id),
  nome text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index grupos_owner_idx on public.grupos (owner_id);

alter table public.grupos enable row level security;
create policy grupos_owner_all on public.grupos
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create trigger grupos_set_updated_at before update on public.grupos
  for each row execute function public.set_updated_at();
create trigger grupos_audit after insert or update or delete on public.grupos
  for each row execute function public.log_account_change();

alter table public.clients add column grupo_id uuid references public.grupos(id) on delete set null;
create index clients_grupo_idx on public.clients (grupo_id);
