-- ============================================================================
-- EnergyIT — dashboard views. Each is `security_invoker = true` so it runs
-- with the *caller's* privileges: the owner-only RLS on the underlying
-- business tables applies exactly as if queried directly. No admin bypass —
-- an admin querying these views sees only their own rows, same as any
-- consultant.
-- ============================================================================

create view public.v_revenue_by_month
with (security_invoker = true) as
select
  owner_id,
  date_trunc('month', coalesce(data_pagamento, created_at::date))::date as mes,
  sum(valor) as total
from public.commissions
where coalesce(data_pagamento, created_at::date) >= (current_date - interval '12 months')
group by owner_id, mes;

create view public.v_funnel_counts
with (security_invoker = true) as
select owner_id, 'SIMULACAO'::text as etapa, count(*) as total
from public.simulations
group by owner_id
union all
select owner_id, 'PROPOSTA_ENVIADA'::text as etapa, count(*) as total
from public.simulations
where estado in ('ENVIADA', 'CONVERTIDA')
group by owner_id
union all
select owner_id, 'CONTRATO_ASSINADO'::text as etapa, count(*) as total
from public.contracts
group by owner_id;

create view public.v_renewals_upcoming
with (security_invoker = true) as
select id, owner_id, client_id, data_fim, (data_fim - current_date) as dias_restantes
from public.contracts
where estado = 'ATIVO'
  and data_fim is not null
  and data_fim between current_date and current_date + interval '90 days';

create view public.v_commissions_by_supplier
with (security_invoker = true) as
select c.owner_id, coalesce(s.nome, 'Sem fornecedor') as fornecedor, sum(c.valor) as total
from public.commissions c
join public.contracts ct on ct.id = c.contract_id
left join public.products p on p.id = ct.product_id
left join public.suppliers s on s.id = p.supplier_id
group by c.owner_id, coalesce(s.nome, 'Sem fornecedor');

create view public.v_commissions_status
with (security_invoker = true) as
select owner_id, estado, sum(valor) as total, count(*) as n
from public.commissions
group by owner_id, estado;

create view public.v_savings_total
with (security_invoker = true) as
select owner_id, sum(poupanca_real_eur) as total
from public.real_savings
group by owner_id;

grant select on
  public.v_revenue_by_month,
  public.v_funnel_counts,
  public.v_renewals_upcoming,
  public.v_commissions_by_supplier,
  public.v_commissions_status,
  public.v_savings_total
to authenticated;
