-- ============================================================================
-- EnergyIT — schema, functions, triggers, RLS
--
-- Two distinct permission levels:
--   1) Business data (clients, invoices, simulations, contracts, real_savings,
--      commissions, audit_log) — strict per-account isolation via
--      owner_id = auth.uid(). NO admin bypass, ever.
--   2) Catalog / pricing engine (suppliers, products, formulas, TAR tables,
--      potencia tables, market indices, commission rules) — global, readable
--      by any authenticated user, writable only by role = 'admin'.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Helper functions
-- ----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- profiles (1 row per auth.users, role drives admin/consultant access)
-- ----------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  nome text,
  role text not null default 'consultant' check (role in ('admin', 'consultant')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- is_admin is `language sql`, validated against the catalog at creation
-- time, so it must come after the profiles table it queries exists.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.prevent_role_self_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Only an admin can change account roles';
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_role_self_escalation();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, nome)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name'))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;

create policy profiles_select_own on public.profiles
  for select using (id = auth.uid());

create policy profiles_select_admin on public.profiles
  for select using (public.is_admin());

create policy profiles_update_own on public.profiles
  for update using (id = auth.uid());

-- ----------------------------------------------------------------------------
-- Generic audit logging
--   admin_audit_log  -> catalog/global table changes, admin-only read
--   audit_log        -> per-account table changes, owner-only read
-- ----------------------------------------------------------------------------

create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  tabela text not null,
  registo_id uuid,
  acao text not null,
  dados_antes jsonb,
  dados_depois jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_audit_log enable row level security;

create policy admin_audit_log_select on public.admin_audit_log
  for select using (public.is_admin());

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  tabela text not null,
  registo_id uuid,
  acao text not null,
  dados_antes jsonb,
  dados_depois jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_log enable row level security;

create policy audit_log_select_own on public.audit_log
  for select using (owner_id = auth.uid());

create or replace function public.log_catalog_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.admin_audit_log (actor_id, tabela, registo_id, acao, dados_antes, dados_depois)
  values (
    auth.uid(),
    tg_table_name,
    coalesce((case when tg_op = 'DELETE' then old.id else new.id end), null),
    tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('UPDATE', 'INSERT') then to_jsonb(new) else null end
  );
  return coalesce(new, old);
end;
$$;

create or replace function public.log_account_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (owner_id, tabela, registo_id, acao, dados_antes, dados_depois)
  values (
    coalesce(new.owner_id, old.owner_id),
    tg_table_name,
    coalesce((case when tg_op = 'DELETE' then old.id else new.id end), null),
    tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('UPDATE', 'INSERT') then to_jsonb(new) else null end
  );
  return coalesce(new, old);
end;
$$;

-- ============================================================================
-- CATALOG (global, admin-write / authenticated-read)
-- ============================================================================

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  contactos text,
  condicoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.potencia_contratada_tabelas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  segmento text not null default 'BTN' check (segmento in ('BTN', 'BTE_MT')),
  created_at timestamptz not null default now()
);

create table public.potencia_contratada_valores (
  id uuid primary key default gen_random_uuid(),
  tabela_id uuid not null references public.potencia_contratada_tabelas(id) on delete cascade,
  potencia_kva numeric not null,
  valor_dia numeric not null,
  unique (tabela_id, potencia_kva)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  segmento text not null check (segmento in ('BTN', 'BTE_MT', 'GAS')),
  supplier_id uuid references public.suppliers(id) on delete set null,
  nome text not null,
  tipo text not null check (tipo in ('ABERTO_FIXO', 'ABERTO_INDEXADO', 'FECHADO')),
  duracao_meses int check (duracao_meses in (12, 18, 24)),
  go_valor numeric,
  preco_limite numeric,
  margem numeric,
  indice_id uuid,
  prioridade_comissao int,
  comissao_fixa numeric,
  potencia_tabela_id uuid references public.potencia_contratada_tabelas(id) on delete set null,
  preco_estatico_com_tar boolean not null default false,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_segmento_idx on public.products (segmento);

create table public.pricing_formulas (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null unique references public.products(id) on delete cascade,
  formula text not null,
  descricao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_energy_prices (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  esquema_horario text not null check (esquema_horario in ('SIMPLES', 'BI_HORARIO', 'TRI_HORARIO', 'TETRA_HORARIO')),
  periodo text not null check (periodo in ('SIMPLES', 'FORA_VAZIO', 'PONTA', 'CHEIA', 'VAZIO', 'SUPER_VAZIO')),
  preco_base numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, esquema_horario, periodo)
);

create table public.tar_energia_btn (
  id uuid primary key default gen_random_uuid(),
  esquema_horario text not null check (esquema_horario in ('SIMPLES', 'BI_HORARIO', 'TRI_HORARIO')),
  periodo text not null check (periodo in ('SIMPLES', 'FORA_VAZIO', 'PONTA', 'CHEIA', 'VAZIO')),
  abaixo_20_7kva boolean not null default false,
  valor numeric not null,
  updated_at timestamptz not null default now(),
  unique (esquema_horario, periodo, abaixo_20_7kva)
);

create table public.tar_potencia_btn (
  id uuid primary key default gen_random_uuid(),
  potencia_kva numeric not null unique,
  valor_dia numeric not null,
  updated_at timestamptz not null default now()
);

create table public.tar_energia_bte_mt (
  id uuid primary key default gen_random_uuid(),
  categoria text not null check (categoria in ('BTE', 'MT')),
  periodo text not null check (periodo in ('PONTA', 'CHEIA', 'VAZIO', 'SUPER_VAZIO')),
  valor numeric not null,
  updated_at timestamptz not null default now(),
  unique (categoria, periodo)
);

create table public.tar_potencia_bte_mt (
  id uuid primary key default gen_random_uuid(),
  categoria text not null unique check (categoria in ('BTE', 'MT')),
  coef_php numeric not null,
  coef_pc numeric not null,
  updated_at timestamptz not null default now()
);

create table public.market_indices (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  valor numeric not null,
  unidade text not null default '€/MWh',
  data_atualizacao date not null default current_date,
  updated_at timestamptz not null default now()
);

alter table public.products
  add constraint products_indice_id_fkey foreign key (indice_id) references public.market_indices(id) on delete set null;

create table public.commission_rules (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  go_min numeric,
  go_max numeric,
  multiplicador numeric not null,
  valido_desde date not null,
  valido_ate date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- updated_at triggers
create trigger suppliers_set_updated_at before update on public.suppliers for each row execute function public.set_updated_at();
create trigger products_set_updated_at before update on public.products for each row execute function public.set_updated_at();
create trigger pricing_formulas_set_updated_at before update on public.pricing_formulas for each row execute function public.set_updated_at();
create trigger product_energy_prices_set_updated_at before update on public.product_energy_prices for each row execute function public.set_updated_at();
create trigger tar_energia_btn_set_updated_at before update on public.tar_energia_btn for each row execute function public.set_updated_at();
create trigger tar_potencia_btn_set_updated_at before update on public.tar_potencia_btn for each row execute function public.set_updated_at();
create trigger tar_energia_bte_mt_set_updated_at before update on public.tar_energia_bte_mt for each row execute function public.set_updated_at();
create trigger tar_potencia_bte_mt_set_updated_at before update on public.tar_potencia_bte_mt for each row execute function public.set_updated_at();
create trigger market_indices_set_updated_at before update on public.market_indices for each row execute function public.set_updated_at();
create trigger commission_rules_set_updated_at before update on public.commission_rules for each row execute function public.set_updated_at();

-- audit triggers
create trigger suppliers_audit after insert or update or delete on public.suppliers for each row execute function public.log_catalog_change();
create trigger products_audit after insert or update or delete on public.products for each row execute function public.log_catalog_change();
create trigger pricing_formulas_audit after insert or update or delete on public.pricing_formulas for each row execute function public.log_catalog_change();
create trigger product_energy_prices_audit after insert or update or delete on public.product_energy_prices for each row execute function public.log_catalog_change();
create trigger tar_energia_btn_audit after insert or update or delete on public.tar_energia_btn for each row execute function public.log_catalog_change();
create trigger tar_potencia_btn_audit after insert or update or delete on public.tar_potencia_btn for each row execute function public.log_catalog_change();
create trigger tar_energia_bte_mt_audit after insert or update or delete on public.tar_energia_bte_mt for each row execute function public.log_catalog_change();
create trigger tar_potencia_bte_mt_audit after insert or update or delete on public.tar_potencia_bte_mt for each row execute function public.log_catalog_change();
create trigger market_indices_audit after insert or update or delete on public.market_indices for each row execute function public.log_catalog_change();
create trigger commission_rules_audit after insert or update or delete on public.commission_rules for each row execute function public.log_catalog_change();
create trigger potencia_contratada_tabelas_audit after insert or update or delete on public.potencia_contratada_tabelas for each row execute function public.log_catalog_change();
create trigger potencia_contratada_valores_audit after insert or update or delete on public.potencia_contratada_valores for each row execute function public.log_catalog_change();

-- RLS: read for any authenticated user, write for admin only
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'suppliers', 'products', 'pricing_formulas', 'product_energy_prices',
      'tar_energia_btn', 'tar_potencia_btn', 'tar_energia_bte_mt', 'tar_potencia_bte_mt',
      'market_indices', 'commission_rules', 'potencia_contratada_tabelas', 'potencia_contratada_valores'
    ])
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I_read_all on public.%I for select using (auth.role() = %L)', t, t, 'authenticated');
    execute format('create policy %I_write_admin on public.%I for insert with check (public.is_admin())', t, t);
    execute format('create policy %I_update_admin on public.%I for update using (public.is_admin())', t, t);
    execute format('create policy %I_delete_admin on public.%I for delete using (public.is_admin())', t, t);
  end loop;
end $$;

-- ============================================================================
-- BUSINESS DATA (per-account, owner_id = auth.uid(), no admin bypass)
-- ============================================================================

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id),
  nome text not null,
  nif text,
  morada text,
  contacto text,
  cpe text,
  cui text,
  segmento_principal text not null default 'BTN' check (segmento_principal in ('BTN', 'BTE_MT', 'GAS')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id),
  client_id uuid not null references public.clients(id) on delete cascade,
  segmento text not null default 'BTN' check (segmento in ('BTN', 'BTE_MT', 'GAS')),
  esquema_horario text not null check (esquema_horario in ('SIMPLES', 'BI_HORARIO', 'TRI_HORARIO', 'TETRA_HORARIO')),
  categoria_bte_mt text check (categoria_bte_mt in ('BTE', 'MT')),
  potencia_contratada_kva numeric,
  consumo_periodos jsonb not null default '{}'::jsonb,
  preco_periodos jsonb default '{}'::jsonb,
  inclui_tar boolean not null default true,
  fornecedor_atual text,
  data_fatura date,
  horas_ponta_diarias numeric,
  dias_faturados int not null default 30,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.simulations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id),
  client_id uuid not null references public.clients(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete set null,
  segmento text not null check (segmento in ('BTN', 'BTE_MT', 'GAS')),
  esquema_horario text not null check (esquema_horario in ('SIMPLES', 'BI_HORARIO', 'TRI_HORARIO', 'TETRA_HORARIO')),
  categoria_bte_mt text check (categoria_bte_mt in ('BTE', 'MT')),
  com_tar boolean not null default true,
  horas_ponta_diarias numeric,
  consumo_anual_periodos jsonb not null default '{}'::jsonb,
  resultados jsonb not null default '[]'::jsonb,
  produto_sugerido_id uuid references public.products(id),
  produto_escolhido_id uuid references public.products(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id),
  client_id uuid not null references public.clients(id) on delete cascade,
  simulation_id uuid references public.simulations(id) on delete set null,
  product_id uuid references public.products(id),
  precos_congelados jsonb not null default '{}'::jsonb,
  potencia_contratada_kva numeric,
  data_inicio date not null default current_date,
  data_fim date,
  estado text not null default 'ATIVO' check (estado in ('ATIVO', 'TERMINADO', 'CANCELADO')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.real_savings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  periodo_referencia text,
  consumo_real_periodos jsonb not null default '{}'::jsonb,
  custo_real_contrato numeric not null,
  custo_estimado_anterior numeric not null,
  poupanca_real_eur numeric not null,
  poupanca_real_pct numeric not null,
  created_at timestamptz not null default now()
);

create table public.commissions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  consumo_anual_kwh numeric,
  go_aplicado numeric,
  multiplicador_aplicado numeric,
  regra_id uuid references public.commission_rules(id),
  valor numeric not null,
  estado text not null default 'NAO_PAGO' check (estado in ('PAGO', 'NAO_PAGO')),
  data_pagamento date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index clients_owner_idx on public.clients (owner_id);
create index invoices_owner_idx on public.invoices (owner_id);
create index invoices_client_idx on public.invoices (client_id);
create index simulations_owner_idx on public.simulations (owner_id);
create index simulations_client_idx on public.simulations (client_id);
create index contracts_owner_idx on public.contracts (owner_id);
create index contracts_client_idx on public.contracts (client_id);
create index real_savings_owner_idx on public.real_savings (owner_id);
create index commissions_owner_idx on public.commissions (owner_id);

create trigger clients_set_updated_at before update on public.clients for each row execute function public.set_updated_at();
create trigger invoices_set_updated_at before update on public.invoices for each row execute function public.set_updated_at();
create trigger simulations_set_updated_at before update on public.simulations for each row execute function public.set_updated_at();
create trigger contracts_set_updated_at before update on public.contracts for each row execute function public.set_updated_at();
create trigger commissions_set_updated_at before update on public.commissions for each row execute function public.set_updated_at();

create trigger clients_audit after insert or update or delete on public.clients for each row execute function public.log_account_change();
create trigger invoices_audit after insert or update or delete on public.invoices for each row execute function public.log_account_change();
create trigger simulations_audit after insert or update or delete on public.simulations for each row execute function public.log_account_change();
create trigger contracts_audit after insert or update or delete on public.contracts for each row execute function public.log_account_change();
create trigger real_savings_audit after insert or update or delete on public.real_savings for each row execute function public.log_account_change();
create trigger commissions_audit after insert or update or delete on public.commissions for each row execute function public.log_account_change();

-- RLS: strict owner-only, no admin bypass
do $$
declare
  t text;
begin
  for t in
    select unnest(array['clients', 'invoices', 'simulations', 'contracts', 'real_savings', 'commissions'])
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I_owner_all on public.%I for all using (owner_id = auth.uid()) with check (owner_id = auth.uid())', t, t);
  end loop;
end $$;
