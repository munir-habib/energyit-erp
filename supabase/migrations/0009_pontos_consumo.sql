-- ============================================================================
-- EnergyIT — Pontos de Consumo (CPE) com histórico de renovações.
-- Entidade nova, distinta de clients/contracts: um cliente pode ter vários
-- CPEs. Cada CPE tem uma lista de periodos_contrato (uma por renovação); os
-- campos "atuais" em pontos_consumo são sempre uma cache sincronizada do
-- período mais recente via trigger — nunca editados diretamente.
-- Business data: owner_id = auth.uid(), RLS estrita, sem bypass admin.
-- ============================================================================

create table public.pontos_consumo (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id),
  client_id uuid references public.clients(id) on delete set null,
  cpe text not null,
  cliente text not null,
  nif text,
  estado text not null default 'Ativo' check (estado in ('Ativo', 'Desativo')),
  potencia_contratada numeric,
  consumo_anual numeric,
  data_ativacao date,
  data_fim_contrato date,
  num_periodos int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.periodos_contrato (
  id uuid primary key default gen_random_uuid(),
  ponto_consumo_id uuid not null references public.pontos_consumo(id) on delete cascade,
  owner_id uuid not null default auth.uid() references public.profiles(id),
  data_inicio date not null,
  data_fim date,
  estado text not null default 'Ativo' check (estado in ('Ativo', 'Desativo')),
  potencia_contratada numeric,
  consumo_anual numeric,
  criado_em timestamptz not null default now()
);

create table public.pontos_consumo_prefs (
  owner_id uuid primary key references public.profiles(id),
  colunas jsonb,
  filtros jsonb,
  ordenacao jsonb,
  updated_at timestamptz not null default now()
);

create index pontos_consumo_owner_idx on public.pontos_consumo (owner_id);
create index pontos_consumo_client_idx on public.pontos_consumo (client_id);
create index periodos_contrato_owner_idx on public.periodos_contrato (owner_id);
create index periodos_contrato_ponto_idx on public.periodos_contrato (ponto_consumo_id);

-- ----------------------------------------------------------------------------
-- Cache sync: pontos_consumo.{estado, potencia_contratada, consumo_anual,
-- data_ativacao, data_fim_contrato, num_periodos} sempre refletem o período
-- mais recente (data_fim desc nulls first, depois criado_em desc).
-- ----------------------------------------------------------------------------

create or replace function public.sync_ponto_consumo_from_periodo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ponto_id uuid;
  v_latest record;
  v_count int;
begin
  v_ponto_id := coalesce(new.ponto_consumo_id, old.ponto_consumo_id);

  select data_inicio, data_fim, estado, potencia_contratada, consumo_anual
    into v_latest
    from public.periodos_contrato
    where ponto_consumo_id = v_ponto_id
    order by data_fim desc nulls first, criado_em desc
    limit 1;

  select count(*) into v_count from public.periodos_contrato where ponto_consumo_id = v_ponto_id;

  update public.pontos_consumo
    set data_ativacao = v_latest.data_inicio,
        data_fim_contrato = v_latest.data_fim,
        estado = coalesce(v_latest.estado, estado),
        potencia_contratada = coalesce(v_latest.potencia_contratada, potencia_contratada),
        consumo_anual = coalesce(v_latest.consumo_anual, consumo_anual),
        num_periodos = v_count,
        updated_at = now()
    where id = v_ponto_id;

  return coalesce(new, old);
end;
$$;

create trigger periodos_contrato_sync
  after insert or update or delete on public.periodos_contrato
  for each row execute function public.sync_ponto_consumo_from_periodo();

-- ----------------------------------------------------------------------------
-- Renovação: fecha o período atual mantendo a sua data_fim, e usa essa
-- data_fim como data_inicio do novo período. Corre com o RLS do chamador
-- (sem security definer) — só afeta CPEs do próprio consultor.
-- ----------------------------------------------------------------------------

create or replace function public.renovar_ponto_consumo(
  p_ponto_consumo_id uuid,
  p_nova_data_fim date,
  p_estado text default null,
  p_potencia_contratada numeric default null,
  p_consumo_anual numeric default null
)
returns public.periodos_contrato
language plpgsql
as $$
declare
  v_atual public.periodos_contrato;
  v_novo public.periodos_contrato;
begin
  select * into v_atual
    from public.periodos_contrato
    where ponto_consumo_id = p_ponto_consumo_id
    order by data_fim desc nulls first, criado_em desc
    limit 1;

  if v_atual.id is null then
    raise exception 'Ponto de consumo % não tem nenhum período de contrato registado', p_ponto_consumo_id;
  end if;

  if v_atual.data_fim is null then
    raise exception 'O período atual não tem data_fim definida — não é possível encadear uma renovação';
  end if;

  insert into public.periodos_contrato (
    ponto_consumo_id, data_inicio, data_fim, estado, potencia_contratada, consumo_anual
  ) values (
    p_ponto_consumo_id,
    v_atual.data_fim,
    p_nova_data_fim,
    coalesce(p_estado, v_atual.estado),
    coalesce(p_potencia_contratada, v_atual.potencia_contratada),
    coalesce(p_consumo_anual, v_atual.consumo_anual)
  )
  returning * into v_novo;

  return v_novo;
end;
$$;

-- ----------------------------------------------------------------------------
-- Backfill idempotente: cria o primeiro periodo_contrato para qualquer
-- ponto_consumo que ainda não tenha nenhum período, a partir dos campos
-- antigos (data_ativacao/data_fim_contrato/estado/potencia/consumo). Seguro
-- para correr múltiplas vezes.
-- ----------------------------------------------------------------------------

insert into public.periodos_contrato (ponto_consumo_id, owner_id, data_inicio, data_fim, estado, potencia_contratada, consumo_anual)
select pc.id, pc.owner_id, pc.data_ativacao, pc.data_fim_contrato, pc.estado, pc.potencia_contratada, pc.consumo_anual
from public.pontos_consumo pc
where pc.data_ativacao is not null
  and not exists (select 1 from public.periodos_contrato pp where pp.ponto_consumo_id = pc.id);

-- updated_at / audit triggers
create trigger pontos_consumo_set_updated_at before update on public.pontos_consumo for each row execute function public.set_updated_at();
create trigger pontos_consumo_audit after insert or update or delete on public.pontos_consumo for each row execute function public.log_account_change();
create trigger periodos_contrato_audit after insert or update or delete on public.periodos_contrato for each row execute function public.log_account_change();

-- RLS: strict owner-only, no admin bypass — same pattern as clients/contracts
alter table public.pontos_consumo enable row level security;
alter table public.periodos_contrato enable row level security;
alter table public.pontos_consumo_prefs enable row level security;

create policy pontos_consumo_owner_all on public.pontos_consumo
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy periodos_contrato_owner_all on public.periodos_contrato
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy pontos_consumo_prefs_owner_all on public.pontos_consumo_prefs
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
