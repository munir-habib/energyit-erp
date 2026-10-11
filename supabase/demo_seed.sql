-- ============================================================================
-- DEMO SEED — dados fictícios para gravar o vídeo de demonstração do sistema.
-- ============================================================================
-- Tudo aqui fica isolado por owner_id (RLS) na conta demo@example.com — nunca
-- toca em nenhuma linha de outra conta, incluindo a conta real do consultor.
-- Produtos/fórmulas/TAR/GO padrão são globais (geridos pelo Admin) e não são
-- duplicados aqui, só referenciados por id.
--
-- PRÉ-REQUISITO: crie primeiro a conta demo pelo ecrã de Registo da própria
-- app (/registar) com o email abaixo — nunca por SQL direto contra
-- auth.users (mais seguro, evita problemas de hash de password/confirmação
-- de email geridos pelo Supabase Auth). Só depois corra este script.
--
-- Idempotência: NÃO é idempotente — correr 2 vezes duplica os dados. Se
-- precisar de recomeçar, apague primeiro as linhas desta conta (script à
-- parte, a pedido, nunca por automatismo — ver memória "destructive-db-
-- changes-confirmation").
--
-- No fim, mostra um resumo (clientes, grupos, CPEs por alerta, simulações por
-- estado, contratos, comissões) — é esse resumo que confirma ao consultor o
-- que foi criado.

begin;

do $$
declare
  v_owner uuid;
begin
  select id into v_owner from auth.users where email = 'demo@example.com';
  if v_owner is null then
    raise exception 'Conta demo não encontrada — crie primeiro via /registar com o email demo@example.com, depois corra este script outra vez.';
  end if;
end $$;

create temp table demo_ctx as
  select id as owner_id from auth.users where email = 'demo@example.com';

-- ----------------------------------------------------------------------------
-- 1. Grupos (4) — a maioria dos clientes fica sem grupo (individual)
-- ----------------------------------------------------------------------------
create temp table demo_grupos as
  with novo as (
    insert into public.grupos (owner_id, nome)
    select owner_id, nome
    from demo_ctx, (values
      ('Grupo Atlântico Retail'),
      ('Grupo Central Manufatura'),
      ('Grupo Litoral Serviços'),
      ('Grupo Ibérico Distribuição')
    ) as g(nome)
    returning id, nome
  )
  select id, nome, row_number() over (order by nome) as ord from novo;

-- ----------------------------------------------------------------------------
-- 2. 50 clientes fictícios — nomes/NIFs inventados (NIF com dígito de controlo
--    válido, formato real, número sem qualquer correspondência com NIFs reais).
--    ~14 distribuídos pelos 4 grupos (3-4 cada), os restantes individuais.
-- ----------------------------------------------------------------------------
create temp table demo_nomes as
  select
    n,
    (array[
      'Padaria','Metalúrgica','Transportes','Construções','Consultores','Têxteis','Restaurante',
      'Clínica','Oficina','Supermercado','Contabilidade','Agência de Viagens','Imobiliária','Software',
      'Elétrica','Serralharia','Carpintaria','Hotel','Farmácia','Ótica','Panificadora','Mercearia',
      'Gráfica','Estofos','Cerâmica'
    ])[1 + ((n - 1) % 25)]
    || ' ' ||
    (array[
      'Central','do Norte','do Sul','Atlântico','Lusitano','Ibérico','Moderno','Premium','Real',
      'Nacional','Litoral','do Vale','Dourado','Estrela','do Minho','Alentejano','Aveirense',
      'Bracarense','Invicta','Tejo'
    ])[1 + (((n * 7) - 1) % 20)]
    || ' ' ||
    (case when n % 3 = 0 then 'SA' else 'Lda' end) as nome,
    (array['BTN','BTE','MT'])[1 + ((n - 1) % 3)] as segmento_principal,
    (array['Ana Ferreira','Bruno Costa','Carla Sousa','Diogo Martins','Elsa Pinto'])[1 + ((n - 1) % 5)] as consultor
  from generate_series(1, 50) as n;

create temp table demo_nifs as
  select n,
    d1, d2, d3, d4, d5, d6, d7, d8,
    case when chk >= 10 then 0 else chk end as chk
  from (
    select n,
      5 as d1, (n * 37) % 10 as d2, (n * 53) % 10 as d3, (n * 19) % 10 as d4,
      (n * 7) % 10 as d5, (n * 13) % 10 as d6, (n * 29) % 10 as d7, (n * 41) % 10 as d8
    from generate_series(1, 50) as n
  ) base,
  lateral (select 11 - (((5*9) + (((n*37)%10)*8) + (((n*53)%10)*7) + (((n*19)%10)*6) + (((n*7)%10)*5) + (((n*13)%10)*4) + (((n*29)%10)*3) + (((n*41)%10)*2)) % 11) as chk) c;

create temp table demo_clients as
  with base as (
    select
      nm.n,
      nm.nome,
      (nf.d1::text || nf.d2::text || nf.d3::text || nf.d4::text || nf.d5::text || nf.d6::text || nf.d7::text || nf.d8::text || nf.chk::text) as nif,
      nm.segmento_principal,
      nm.consultor,
      case when nm.n <= 14 then dg.id else null end as grupo_id
    from demo_nomes nm
    join demo_nifs nf using (n)
    left join demo_grupos dg on dg.ord = 1 + ((nm.n - 1) % 4) and nm.n <= 14
  ),
  novo as (
    insert into public.clients (owner_id, nome, nif, morada, contacto, cui, segmento_principal, consultor_responsavel, grupo_id)
    select ctx.owner_id, b.nome, b.nif, null, null, null, b.segmento_principal, b.consultor, b.grupo_id
    from base b, demo_ctx ctx
    returning id, nome, segmento_principal
  )
  select novo.id, base.n, novo.nome, novo.segmento_principal from novo join base on base.nome = novo.nome;

-- ----------------------------------------------------------------------------
-- 3. Pontos de Consumo (CPE) — 1 a 3 por cliente, segmento a rodar
--    BTN/BTE/MT, datas de renovação cobrindo os 4 alertas pedidos.
-- ----------------------------------------------------------------------------
create temp table demo_pontos_base as
  select
    c.id as client_id,
    c.nome as cliente_nome,
    k as cpe_idx,
    row_number() over (order by c.n, k) as global_idx,
    (array['BTN','BTE','MT'])[1 + ((c.n + k - 1) % 3)] as segmento,
    'PT' || lpad((900000000000000 + c.n * 37 + k * 11)::text, 16, '0') as cpe
  from demo_clients c
  cross join lateral generate_series(1, 1 + (c.n % 3)) as k; -- 1 a 3 CPEs por cliente

create temp table demo_pontos_dias as
  select *,
    case (global_idx % 6)
      when 0 then 5 + ((global_idx * 3) % 3)      -- ~5 dias — alerta vermelho/urgente
      when 1 then 20 + ((global_idx * 5) % 5)     -- ~20 dias — alerta âmbar
      when 2 then 50 + ((global_idx * 7) % 7)     -- ~50 dias — alerta azul
      when 3 then 200 + ((global_idx * 11) % 120) -- >6 meses — sem alerta
      when 4 then 95 + ((global_idx * 13) % 60)   -- espalhado, sem alerta específico pedido
      else 150 + ((global_idx * 17) % 90)
    end as dias_renovacao
  from demo_pontos_base;

-- Força as 2 primeiras CPEs a já terem passado da data (estado "vencido").
create temp table demo_pontos as
  select *,
    case
      when global_idx = 1 then -3
      when global_idx = 2 then -10
      else dias_renovacao
    end as dias_final
  from demo_pontos_dias;

create temp table demo_pontos_ids as
  with novo as (
    insert into public.pontos_consumo (owner_id, client_id, cpe, cliente, nif, estado, potencia_contratada, consumo_anual, data_ativacao, data_fim_contrato, num_periodos)
    select
      ctx.owner_id, dp.client_id, dp.cpe, dp.cliente_nome, null, 'Ativo',
      case dp.segmento when 'BTN' then 6.9 when 'BTE' then 41.4 else 250 end,
      case dp.segmento when 'BTN' then 6000 when 'BTE' then 120000 else 1500000 end,
      current_date - interval '1 year',
      current_date + (dp.dias_final || ' days')::interval,
      1
    from demo_pontos dp, demo_ctx ctx
    returning id, cpe, client_id
  )
  select n.id, n.cpe, n.client_id, dp.global_idx, dp.segmento, dp.dias_final, dp.client_id as c_id
  from novo n join demo_pontos dp on dp.cpe = n.cpe;

insert into public.periodos_contrato (ponto_consumo_id, owner_id, data_inicio, data_fim, estado, potencia_contratada, consumo_anual)
select dpi.id, ctx.owner_id, current_date - interval '1 year', current_date + (dpi.dias_final || ' days')::interval, 'Ativo',
  case dpi.segmento when 'BTN' then 6.9 when 'BTE' then 41.4 else 250 end,
  case dpi.segmento when 'BTN' then 6000 when 'BTE' then 120000 else 1500000 end
from demo_pontos_ids dpi, demo_ctx ctx;

-- ----------------------------------------------------------------------------
-- 4. Produtos representativos por segmento (globais, geridos pelo Admin) —
--    escolhidos aleatoriamente entre os ativos, 2 por segmento (produto A/B).
-- ----------------------------------------------------------------------------
create temp table demo_ranked_products as
  select id, nome, tipo, segmento, go_valor,
    row_number() over (partition by segmento order by random()) as rn
  from public.products
  where ativo = true;

create temp table demo_product_a as select segmento, id, nome, tipo, go_valor from demo_ranked_products where rn = 1;
create temp table demo_product_b as select segmento, id, nome, tipo, go_valor from demo_ranked_products where rn = 2;

-- Produtos EZU/SuperNova BTE GO reais (para o cenário lado-a-lado pedido) — o
-- nome do produto em si é só "BTE GO" (a comercializadora vem do supplier_id,
-- nunca do nome), por isso o filtro é pelo fornecedor. Se não encontrar (ex:
-- catálogo sem esses fornecedores), o script continua com o produto A/B
-- genérico do segmento em vez disso, nunca falha o resto do seed por causa disto.
create temp table demo_ezu_bte as
  select p.id, p.nome, p.tipo, p.go_valor from public.products p
  join public.suppliers s on s.id = p.supplier_id
  where p.segmento = 'BTE' and p.ativo = true and s.nome ilike '%ezu%' limit 1;
create temp table demo_sn_bte as
  select p.id, p.nome, p.tipo, p.go_valor from public.products p
  join public.suppliers s on s.id = p.supplier_id
  where p.segmento = 'BTE' and p.ativo = true and s.nome ilike '%super%nova%' limit 1;

-- Pesos/relativos de preço por período — só para as 4 colunas do esquema
-- Tetra-Horário (BTE/MT) mostrarem valores plausíveis e distintos por período
-- em vez de só 1 período preenchido (o Simples do BTN só tem 1 período,
-- sempre 100% do consumo/preço-base). A média ponderada dá ~1.0× o preço-base
-- pedido, por isso o preço médio/poupança apresentados continuam corretos.
create temp table demo_periodos_pesos (segmento_grupo text, periodo text, peso numeric, price_rel numeric);
insert into demo_periodos_pesos values
  ('SIMPLES', 'SIMPLES', 1.00, 1.00),
  ('TETRA', 'PONTA', 0.15, 1.35),
  ('TETRA', 'CHEIA', 0.40, 1.05),
  ('TETRA', 'VAZIO', 0.30, 0.85),
  ('TETRA', 'SUPER_VAZIO', 0.15, 0.75);

-- ----------------------------------------------------------------------------
-- 5. Simulações — 1 por CPE (regra "1 ativa por CPE"), em 3 estados:
--    0 = candidatas marcadas, ainda sem escolhida (decisão pendente)
--    1 = escolhida definida (fecha com contrato + comissão)
--    2 = cenário EZU vs SuperNova lado a lado, GOs diferentes (só nas
--        primeiras CPEs de segmento BTE, quando o catálogo real tem os 2
--        produtos — ver demo_ezu_bte/demo_sn_bte acima)
-- ----------------------------------------------------------------------------
create temp table demo_sim_estado as
  select dpi.*,
    row_number() over (partition by dpi.segmento order by dpi.global_idx) as rn_no_segmento,
    (dpi.global_idx % 2) as estado_base -- 0 = pendente, 1 = escolhida/fechado
  from demo_pontos_ids dpi;

create temp table demo_sims_calc as
  select
    s.id as ponto_id, s.client_id, s.segmento, s.global_idx,
    case when s.segmento = 'BTE' and s.rn_no_segmento <= 3
           and exists (select 1 from demo_ezu_bte) and exists (select 1 from demo_sn_bte)
         then 2 else s.estado_base end as estado,
    case s.segmento when 'BTN' then 'SIMPLES' else 'TETRA_HORARIO' end as esquema_horario,
    case s.segmento when 'BTN' then 450 when 'BTE' then 9500 when 'MT' then 85000 end as consumo_total,
    case s.segmento when 'BTN' then 0.185 when 'BTE' then 0.148 when 'MT' then 0.121 end as preco_atual,
    case s.segmento when 'BTN' then 6.9 when 'BTE' then 41.4 else 250 end as potencia_kva
  from demo_sim_estado s;

-- Linha A e B de cada simulação (produto genérico do segmento, ou EZU/SuperNova
-- reais nas simulações de estado=2), com GO e poupança coerentes entre si.
create temp table demo_sims_linhas as
  select
    c.*,
    case when c.estado = 2 then coalesce((select nome from demo_ezu_bte), pa.nome) else pa.nome end as prod_a_nome,
    case when c.estado = 2 then coalesce((select id from demo_ezu_bte), pa.id) else pa.id end as prod_a_id,
    case when c.estado = 2 then coalesce((select tipo from demo_ezu_bte), pa.tipo) else pa.tipo end as prod_a_tipo,
    case when c.estado = 2 then coalesce((select nome from demo_sn_bte), pb.nome) else pb.nome end as prod_b_nome,
    case when c.estado = 2 then coalesce((select id from demo_sn_bte), pb.id) else pb.id end as prod_b_id,
    case when c.estado = 2 then coalesce((select tipo from demo_sn_bte), pb.tipo) else pb.tipo end as prod_b_tipo,
    case when c.estado = 2 then 8 else 12 + (c.global_idx % 10) end as go_a,
    case when c.estado = 2 then 20 else 15 + (c.global_idx % 8) end as go_b,
    case when c.estado = 2 then 0.184 else 0.15 + ((c.global_idx % 5) * 0.01) end as preco_novo_a_pct_mult,
    case when c.estado = 2 then 0.091 else 0.09 + ((c.global_idx % 4) * 0.01) end as preco_novo_b_pct_mult
  from demo_sims_calc c
  join demo_product_a pa on pa.segmento = c.segmento
  -- left join defensivo: se o segmento só tiver 1 produto ativo no catálogo real, usa o mesmo produto
  -- A também como B (2 linhas do mesmo produto, GOs diferentes) em vez de perder a simulação toda.
  left join demo_product_b pb0 on pb0.segmento = c.segmento
  cross join lateral (select coalesce(pb0.id, pa.id) as id, coalesce(pb0.nome, pa.nome) as nome, coalesce(pb0.tipo, pa.tipo) as tipo) pb;

-- preco_novo_a/b são, na prática, a % de poupança-alvo dessa linha (0.184 =
-- 18,4% de poupança) — o "mult" no nome é só para deixar claro que é isto que
-- deriva o preço novo a partir do preço atual, não um preço absoluto.
create temp table demo_sims_final as
  select l.*,
    round((l.preco_atual * (1 - l.preco_novo_a_pct_mult))::numeric, 4) as preco_a,
    round((l.preco_atual * (1 - l.preco_novo_b_pct_mult))::numeric, 4) as preco_b,
    round((l.consumo_total * l.preco_atual)::numeric, 2) as custo_atual_total
  from demo_sims_linhas l;

create temp table demo_sims_ids as
  with novo as (
    insert into public.simulations (
      owner_id, client_id, ponto_consumo_id, segmento, esquema_horario, com_tar, horas_ponta_diarias,
      dias_faturados, modo_preco_atual, inclui_tar_atual, consumo_periodo, resultados,
      produto_sugerido_id, produto_escolhido_id, potencia_contratada_kva, preco_atual_periodos,
      valor_total_periodo, go_override, ativa
    )
    select
      ctx.owner_id, f.client_id, f.ponto_id, f.segmento, f.esquema_horario, true, null,
      30, 'TOTAL', true,
      (select jsonb_object_agg(pp.periodo, round(f.consumo_total * pp.peso))
         from demo_periodos_pesos pp where pp.segmento_grupo = (case f.segmento when 'BTN' then 'SIMPLES' else 'TETRA' end)),
      jsonb_build_array(
        jsonb_build_object(
          'product_id', f.prod_a_id, 'produto_nome', f.prod_a_nome, 'tipo', f.prod_a_tipo,
          'variant_id', null, 'variant_label', null,
          'precos_periodo', (select jsonb_object_agg(pp.periodo, round((f.preco_a * pp.price_rel)::numeric, 4))
                               from demo_periodos_pesos pp where pp.segmento_grupo = (case f.segmento when 'BTN' then 'SIMPLES' else 'TETRA' end)),
          'custo_energia_periodo', round((f.consumo_total * f.preco_a)::numeric, 2),
          'poupanca_eur_periodo', round((f.custo_atual_total - f.consumo_total * f.preco_a)::numeric, 2),
          'poupanca_eur_mes', round((f.custo_atual_total - f.consumo_total * f.preco_a)::numeric, 2),
          'poupanca_eur_ano', round(((f.custo_atual_total - f.consumo_total * f.preco_a) * 12)::numeric, 2),
          'poupanca_pct', round((f.preco_novo_a_pct_mult * 100)::numeric, 1),
          'alerta_go', false, 'prioridade_comissao', null, 'custo_atual_indefinido', false,
          'potencia_eur_dia', 0,
          'go_override', case when f.prod_a_tipo = 'FECHADO' then null else f.go_a end,
          'go_fixado', (f.estado = 1),
          'candidata', true,
          'escolhida', (f.estado = 1)
        ),
        jsonb_build_object(
          'product_id', f.prod_b_id, 'produto_nome', f.prod_b_nome, 'tipo', f.prod_b_tipo,
          'variant_id', null, 'variant_label', null,
          'precos_periodo', (select jsonb_object_agg(pp.periodo, round((f.preco_b * pp.price_rel)::numeric, 4))
                               from demo_periodos_pesos pp where pp.segmento_grupo = (case f.segmento when 'BTN' then 'SIMPLES' else 'TETRA' end)),
          'custo_energia_periodo', round((f.consumo_total * f.preco_b)::numeric, 2),
          'poupanca_eur_periodo', round((f.custo_atual_total - f.consumo_total * f.preco_b)::numeric, 2),
          'poupanca_eur_mes', round((f.custo_atual_total - f.consumo_total * f.preco_b)::numeric, 2),
          'poupanca_eur_ano', round(((f.custo_atual_total - f.consumo_total * f.preco_b) * 12)::numeric, 2),
          'poupanca_pct', round((f.preco_novo_b_pct_mult * 100)::numeric, 1),
          'alerta_go', false, 'prioridade_comissao', null, 'custo_atual_indefinido', false,
          'potencia_eur_dia', 0,
          'go_override', case when f.prod_b_tipo = 'FECHADO' then null else f.go_b end,
          'go_fixado', false,
          'candidata', (f.estado <> 1),
          'escolhida', false
        )
      ),
      f.prod_a_id,
      case when f.estado = 1 then f.prod_a_id else null end,
      f.potencia_kva, null, f.custo_atual_total, null, true
    from demo_sims_final f, demo_ctx ctx
    returning id, client_id, ponto_consumo_id, produto_escolhido_id
  )
  select novo.*, f.estado, f.custo_atual_total, f.consumo_total, f.go_a, f.potencia_kva, f.segmento, f.preco_a
  from novo join demo_sims_final f on f.ponto_id = novo.ponto_consumo_id;

-- ----------------------------------------------------------------------------
-- 6. Contratos + Comissões — só para as simulações já com Escolhida (estado 1)
-- ----------------------------------------------------------------------------
create temp table demo_contratos_ids as
  with novo as (
    insert into public.contracts (owner_id, client_id, simulation_id, product_id, precos_congelados, potencia_contratada_kva, data_inicio, data_fim, estado)
    select
      ctx.owner_id, s.client_id, s.id, s.produto_escolhido_id,
      (select jsonb_object_agg(pp.periodo, round((s.preco_a * pp.price_rel)::numeric, 4))
         from demo_periodos_pesos pp where pp.segmento_grupo = (case s.segmento when 'BTN' then 'SIMPLES' else 'TETRA' end)),
      s.potencia_kva, current_date - interval '2 months', current_date + interval '10 months', 'ATIVO'
    from demo_sims_ids s, demo_ctx ctx
    where s.estado = 1
    returning id, simulation_id
  )
  select novo.id, novo.simulation_id, s.go_a, s.consumo_total, row_number() over (order by novo.id) as rn
  from novo join demo_sims_ids s on s.id = novo.simulation_id;

insert into public.commissions (owner_id, contract_id, consumo_anual_kwh, go_aplicado, multiplicador_aplicado, regra_id, valor, estado, data_pagamento)
select
  ctx.owner_id, dci.id, dci.consumo_total * 12, dci.go_a, 1, null,
  round((150 + (dci.go_a * dci.consumo_total / 1000.0))::numeric, 2),
  case when dci.rn % 2 = 0 then 'PAGO' else 'NAO_PAGO' end,
  case when dci.rn % 2 = 0 then current_date - interval '15 days' else null end
from demo_contratos_ids dci, demo_ctx ctx;

commit;

-- ----------------------------------------------------------------------------
-- Resumo final — mostrar sempre ao consultor antes de aceitar como aplicado.
-- ----------------------------------------------------------------------------
select
  (select count(*) from demo_clients) as clientes_criados,
  (select count(*) from demo_grupos) as grupos_criados,
  (select count(*) filter (where grupo_id is not null) from public.clients where owner_id = (select owner_id from demo_ctx)) as clientes_em_grupo,
  (select count(*) from demo_pontos_ids) as cpes_criados,
  (select count(*) from demo_pontos_ids where dias_final <= 7) as cpes_alerta_vermelho,
  (select count(*) from demo_pontos_ids where dias_final > 7 and dias_final <= 30) as cpes_alerta_ambar,
  (select count(*) from demo_pontos_ids where dias_final > 30 and dias_final <= 60) as cpes_alerta_azul,
  (select count(*) from demo_pontos_ids where dias_final > 60) as cpes_sem_alerta,
  (select count(*) from demo_sims_ids) as simulacoes_criadas,
  (select count(*) from demo_sims_ids where estado = 0) as simulacoes_pendentes,
  (select count(*) from demo_sims_ids where estado = 1) as simulacoes_fechadas,
  (select count(*) from demo_sims_ids where estado = 2) as simulacoes_ezu_vs_supernova,
  (select count(*) from demo_contratos_ids) as contratos_criados,
  (select count(*) from public.commissions c join demo_contratos_ids dci on dci.id = c.contract_id where c.estado = 'PAGO') as comissoes_pagas,
  (select count(*) from public.commissions c join demo_contratos_ids dci on dci.id = c.contract_id where c.estado = 'NAO_PAGO') as comissoes_pendentes;
