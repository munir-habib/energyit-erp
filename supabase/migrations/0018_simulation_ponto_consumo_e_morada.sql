-- Liga uma simulação a uma CPE (ponto de consumo) específica — opcional, para o
-- documento de aprovação interna multi-CPE poder identificar cada simulação.
-- Não mexe no motor de cálculo nem no catálogo: coluna nullable, sem backfill.
alter table public.simulations
  add column ponto_consumo_id uuid references public.pontos_consumo(id) on delete set null;

create index simulations_ponto_consumo_idx on public.simulations (ponto_consumo_id);

-- Morada da CPE — usada na identificação da CPE no documento de aprovação.
alter table public.pontos_consumo
  add column morada text;
