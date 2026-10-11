-- ============================================================================
-- EnergyIT — seed data for the electricity catalog (BTN + BTE&MT)
-- GO de referência usado nestas fichas = 10 €/MWh (campo editável pelo Admin)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Fornecedor de referência para os produtos abertos
-- ----------------------------------------------------------------------------
insert into public.suppliers (id, nome, contactos, condicoes) values
  ('00000000-0000-0000-0000-000000000001', 'Mercado Livre — Referência', null, 'Preços de referência usados como base de simulação.');

-- ----------------------------------------------------------------------------
-- Índice de mercado de referência (para produtos indexados)
-- ----------------------------------------------------------------------------
insert into public.market_indices (id, nome, valor, unidade, data_atualizacao) values
  ('00000000-0000-0000-0000-000000000002', 'OMIP', 85, '€/MWh', current_date);

-- ----------------------------------------------------------------------------
-- Tabelas de Potência Contratada (Produtos Fechados BTN)
-- X tem tabela própria; Z/Deluxe partilham; ZC/Deluxe+ partilham
-- ----------------------------------------------------------------------------
insert into public.potencia_contratada_tabelas (id, nome, segmento) values
  ('00000000-0000-0000-0000-000000000010', 'X', 'BTN'),
  ('00000000-0000-0000-0000-000000000011', 'Z / Deluxe', 'BTN'),
  ('00000000-0000-0000-0000-000000000012', 'ZC / Deluxe+', 'BTN');

insert into public.potencia_contratada_valores (tabela_id, potencia_kva, valor_dia) values
  ('00000000-0000-0000-0000-000000000010', 1.15, 0.1444),
  ('00000000-0000-0000-0000-000000000010', 2.3, 0.2287),
  ('00000000-0000-0000-0000-000000000010', 3.45, 0.3231),
  ('00000000-0000-0000-0000-000000000010', 4.6, 0.4175),
  ('00000000-0000-0000-0000-000000000010', 5.75, 0.4919),
  ('00000000-0000-0000-0000-000000000010', 6.9, 0.6062),
  ('00000000-0000-0000-0000-000000000010', 10.35, 0.8193),
  ('00000000-0000-0000-0000-000000000010', 13.8, 1.0424),
  ('00000000-0000-0000-0000-000000000010', 17.25, 1.2656),
  ('00000000-0000-0000-0000-000000000010', 20.7, 1.5187),
  ('00000000-0000-0000-0000-000000000010', 27.6, 1.8649),
  ('00000000-0000-0000-0000-000000000010', 34.5, 2.2411),
  ('00000000-0000-0000-0000-000000000010', 41.4, 2.6073),

  ('00000000-0000-0000-0000-000000000011', 1.15, 0.30118),
  ('00000000-0000-0000-0000-000000000011', 2.3, 0.36301),
  ('00000000-0000-0000-0000-000000000011', 3.45, 0.43044),
  ('00000000-0000-0000-0000-000000000011', 4.6, 0.51998),
  ('00000000-0000-0000-0000-000000000011', 5.75, 0.60655),
  ('00000000-0000-0000-0000-000000000011', 6.9, 0.73757),
  ('00000000-0000-0000-0000-000000000011', 10.35, 0.92986),
  ('00000000-0000-0000-0000-000000000011', 13.8, 1.21103),
  ('00000000-0000-0000-0000-000000000011', 17.25, 1.54092),
  ('00000000-0000-0000-0000-000000000011', 20.7, 1.81483),
  ('00000000-0000-0000-0000-000000000011', 27.6, 1.8682),
  ('00000000-0000-0000-0000-000000000011', 34.5, 2.23903),
  ('00000000-0000-0000-0000-000000000011', 41.4, 2.60986),

  ('00000000-0000-0000-0000-000000000012', 1.15, 0.55202),
  ('00000000-0000-0000-0000-000000000012', 2.3, 0.60979),
  ('00000000-0000-0000-0000-000000000012', 3.45, 0.66755),
  ('00000000-0000-0000-0000-000000000012', 4.6, 0.72532),
  ('00000000-0000-0000-0000-000000000012', 5.75, 0.83806),
  ('00000000-0000-0000-0000-000000000012', 6.9, 0.89572),
  ('00000000-0000-0000-0000-000000000012', 10.35, 1.34368),
  ('00000000-0000-0000-0000-000000000012', 13.8, 1.51698),
  ('00000000-0000-0000-0000-000000000012', 17.25, 1.69038),
  ('00000000-0000-0000-0000-000000000012', 20.7, 1.86358),
  ('00000000-0000-0000-0000-000000000012', 27.6, 2.56101),
  ('00000000-0000-0000-0000-000000000012', 34.5, 2.88268),
  ('00000000-0000-0000-0000-000000000012', 41.4, 3.44988);

-- ----------------------------------------------------------------------------
-- TAR — Componente Energia BTN (€/kWh)
-- ----------------------------------------------------------------------------
insert into public.tar_energia_btn (esquema_horario, periodo, abaixo_20_7kva, valor) values
  ('SIMPLES', 'SIMPLES', false, 0.0607),
  ('BI_HORARIO', 'FORA_VAZIO', false, 0.0835),
  ('BI_HORARIO', 'VAZIO', false, 0.0158),
  ('TRI_HORARIO', 'PONTA', false, 0.2457),
  ('TRI_HORARIO', 'CHEIA', false, 0.0524),
  ('TRI_HORARIO', 'VAZIO', false, 0.015),
  ('TRI_HORARIO', 'PONTA', true, 0.2452),
  ('TRI_HORARIO', 'CHEIA', true, 0.0412),
  ('TRI_HORARIO', 'VAZIO', true, 0.0158);

-- ----------------------------------------------------------------------------
-- TAR — Componente Potência Contratada BTN (€/dia)
-- ----------------------------------------------------------------------------
insert into public.tar_potencia_btn (potencia_kva, valor_dia) values
  (1.15, 0.1637), (2.3, 0.235), (3.45, 0.2595), (4.6, 0.3261), (5.75, 0.3927),
  (6.9, 0.4592), (10.35, 0.6318), (13.8, 0.8224), (17.25, 1.0131), (20.7, 1.2036),
  (27.6, 1.5627), (34.5, 1.9384), (41.4, 2.3141);

-- ----------------------------------------------------------------------------
-- TAR — Componente Energia BTE & MT (€/kWh)
-- ----------------------------------------------------------------------------
insert into public.tar_energia_bte_mt (categoria, periodo, valor) values
  ('BTE', 'PONTA', 0.0397), ('BTE', 'CHEIA', 0.0353), ('BTE', 'VAZIO', 0.0285), ('BTE', 'SUPER_VAZIO', 0.0237),
  ('MT', 'PONTA', 0.0203), ('MT', 'CHEIA', 0.0182), ('MT', 'VAZIO', 0.0146), ('MT', 'SUPER_VAZIO', 0.0129);

-- ----------------------------------------------------------------------------
-- TAR — Componente Potência BTE & MT (coeficientes €/kW/dia)
-- ----------------------------------------------------------------------------
insert into public.tar_potencia_bte_mt (categoria, coef_php, coef_pc) values
  ('BTE', 0.5521, 0.0563),
  ('MT', 0.2435, 0.0458);

-- ----------------------------------------------------------------------------
-- Regras de comissão
-- ----------------------------------------------------------------------------
insert into public.commission_rules (nome, go_min, go_max, multiplicador, valido_desde, valido_ate) values
  ('Padrão — GO ≤ 15', null, 15, 0.125, '2026-01-01', null),
  ('Temporária em negociação — qualquer GO', null, null, 0.15, '2026-06-01', '2026-12-31');

-- ============================================================================
-- Produtos Abertos BTN — Fixo (12 / 18 / 24 meses)
-- Preço Base de Energia sem TAR, antes de GO. GO de referência = 10 €/MWh.
-- ============================================================================

insert into public.products (id, segmento, supplier_id, nome, tipo, duracao_meses, go_valor, ativo)
values
  ('00000000-0000-0000-0000-000000000100', 'BTN', '00000000-0000-0000-0000-000000000001', 'Fixo 12 meses', 'ABERTO_FIXO', 12, 10, true),
  ('00000000-0000-0000-0000-000000000101', 'BTN', '00000000-0000-0000-0000-000000000001', 'Fixo 18 meses', 'ABERTO_FIXO', 18, 10, true),
  ('00000000-0000-0000-0000-000000000102', 'BTN', '00000000-0000-0000-0000-000000000001', 'Fixo 24 meses', 'ABERTO_FIXO', 24, 10, true);

insert into public.product_energy_prices (product_id, esquema_horario, periodo, preco_base) values
  -- 12 meses
  ('00000000-0000-0000-0000-000000000100', 'SIMPLES', 'SIMPLES', 0.0715),
  ('00000000-0000-0000-0000-000000000100', 'BI_HORARIO', 'FORA_VAZIO', 0.072504),
  ('00000000-0000-0000-0000-000000000100', 'BI_HORARIO', 'VAZIO', 0.070599),
  ('00000000-0000-0000-0000-000000000100', 'TRI_HORARIO', 'PONTA', 0.079506),
  ('00000000-0000-0000-0000-000000000100', 'TRI_HORARIO', 'CHEIA', 0.062272),
  ('00000000-0000-0000-0000-000000000100', 'TRI_HORARIO', 'VAZIO', 0.072659),
  -- 18 meses
  ('00000000-0000-0000-0000-000000000101', 'SIMPLES', 'SIMPLES', 0.07),
  ('00000000-0000-0000-0000-000000000101', 'BI_HORARIO', 'FORA_VAZIO', 0.071004),
  ('00000000-0000-0000-0000-000000000101', 'BI_HORARIO', 'VAZIO', 0.069099),
  ('00000000-0000-0000-0000-000000000101', 'TRI_HORARIO', 'PONTA', 0.078006),
  ('00000000-0000-0000-0000-000000000101', 'TRI_HORARIO', 'CHEIA', 0.060772),
  ('00000000-0000-0000-0000-000000000101', 'TRI_HORARIO', 'VAZIO', 0.071159),
  -- 24 meses
  ('00000000-0000-0000-0000-000000000102', 'SIMPLES', 'SIMPLES', 0.0711),
  ('00000000-0000-0000-0000-000000000102', 'BI_HORARIO', 'FORA_VAZIO', 0.072104),
  ('00000000-0000-0000-0000-000000000102', 'BI_HORARIO', 'VAZIO', 0.070199),
  ('00000000-0000-0000-0000-000000000102', 'TRI_HORARIO', 'PONTA', 0.079106),
  ('00000000-0000-0000-0000-000000000102', 'TRI_HORARIO', 'CHEIA', 0.061872),
  ('00000000-0000-0000-0000-000000000102', 'TRI_HORARIO', 'VAZIO', 0.072259);

-- ----------------------------------------------------------------------------
-- Produto Aberto BTN — Indexado (demo do motor de fórmulas)
-- Preço_Base = Indice/1000 + Spread + Margem  (GO é somado depois pelo motor)
-- ----------------------------------------------------------------------------
insert into public.products (id, segmento, supplier_id, nome, tipo, duracao_meses, go_valor, margem, indice_id, ativo)
values
  ('00000000-0000-0000-0000-000000000110', 'BTN', '00000000-0000-0000-0000-000000000001', 'Indexado OMIP 12 meses', 'ABERTO_INDEXADO', 12, 10, 0.01, '00000000-0000-0000-0000-000000000002', true);

insert into public.pricing_formulas (product_id, formula, descricao) values
  ('00000000-0000-0000-0000-000000000110', 'Indice / 1000 + Spread + Margem', 'Preço base indexado ao OMIP + spread por período + margem comercial. O GO é somado automaticamente pelo motor de pricing.');

insert into public.product_energy_prices (product_id, esquema_horario, periodo, preco_base) values
  ('00000000-0000-0000-0000-000000000110', 'SIMPLES', 'SIMPLES', 0.004),
  ('00000000-0000-0000-0000-000000000110', 'BI_HORARIO', 'FORA_VAZIO', 0.0045),
  ('00000000-0000-0000-0000-000000000110', 'BI_HORARIO', 'VAZIO', 0.003),
  ('00000000-0000-0000-0000-000000000110', 'TRI_HORARIO', 'PONTA', 0.006),
  ('00000000-0000-0000-0000-000000000110', 'TRI_HORARIO', 'CHEIA', 0.003),
  ('00000000-0000-0000-0000-000000000110', 'TRI_HORARIO', 'VAZIO', 0.0025);

-- ============================================================================
-- Produtos Abertos BTE & MT (12 / 18 / 24 meses × BTE / MT)
-- ============================================================================

insert into public.products (id, segmento, supplier_id, nome, tipo, duracao_meses, go_valor, ativo) values
  ('00000000-0000-0000-0000-000000000120', 'BTE_MT', '00000000-0000-0000-0000-000000000001', 'BTE — Fixo 12 meses', 'ABERTO_FIXO', 12, 10, true),
  ('00000000-0000-0000-0000-000000000121', 'BTE_MT', '00000000-0000-0000-0000-000000000001', 'MT — Fixo 12 meses', 'ABERTO_FIXO', 12, 10, true),
  ('00000000-0000-0000-0000-000000000122', 'BTE_MT', '00000000-0000-0000-0000-000000000001', 'BTE — Fixo 18 meses', 'ABERTO_FIXO', 18, 10, true),
  ('00000000-0000-0000-0000-000000000123', 'BTE_MT', '00000000-0000-0000-0000-000000000001', 'MT — Fixo 18 meses', 'ABERTO_FIXO', 18, 10, true),
  ('00000000-0000-0000-0000-000000000124', 'BTE_MT', '00000000-0000-0000-0000-000000000001', 'BTE — Fixo 24 meses', 'ABERTO_FIXO', 24, 10, true),
  ('00000000-0000-0000-0000-000000000125', 'BTE_MT', '00000000-0000-0000-0000-000000000001', 'MT — Fixo 24 meses', 'ABERTO_FIXO', 24, 10, true);

insert into public.product_energy_prices (product_id, esquema_horario, periodo, preco_base) values
  -- 12 meses BTE
  ('00000000-0000-0000-0000-000000000120', 'TETRA_HORARIO', 'PONTA', 0.06508),
  ('00000000-0000-0000-0000-000000000120', 'TETRA_HORARIO', 'CHEIA', 0.05629),
  ('00000000-0000-0000-0000-000000000120', 'TETRA_HORARIO', 'VAZIO', 0.08439),
  ('00000000-0000-0000-0000-000000000120', 'TETRA_HORARIO', 'SUPER_VAZIO', 0.08424),
  -- 12 meses MT
  ('00000000-0000-0000-0000-000000000121', 'TETRA_HORARIO', 'PONTA', 0.06308),
  ('00000000-0000-0000-0000-000000000121', 'TETRA_HORARIO', 'CHEIA', 0.05429),
  ('00000000-0000-0000-0000-000000000121', 'TETRA_HORARIO', 'VAZIO', 0.08239),
  ('00000000-0000-0000-0000-000000000121', 'TETRA_HORARIO', 'SUPER_VAZIO', 0.08224),
  -- 18 meses BTE
  ('00000000-0000-0000-0000-000000000122', 'TETRA_HORARIO', 'PONTA', 0.06358),
  ('00000000-0000-0000-0000-000000000122', 'TETRA_HORARIO', 'CHEIA', 0.05479),
  ('00000000-0000-0000-0000-000000000122', 'TETRA_HORARIO', 'VAZIO', 0.08289),
  ('00000000-0000-0000-0000-000000000122', 'TETRA_HORARIO', 'SUPER_VAZIO', 0.08274),
  -- 18 meses MT
  ('00000000-0000-0000-0000-000000000123', 'TETRA_HORARIO', 'PONTA', 0.06158),
  ('00000000-0000-0000-0000-000000000123', 'TETRA_HORARIO', 'CHEIA', 0.05279),
  ('00000000-0000-0000-0000-000000000123', 'TETRA_HORARIO', 'VAZIO', 0.08089),
  ('00000000-0000-0000-0000-000000000123', 'TETRA_HORARIO', 'SUPER_VAZIO', 0.08074),
  -- 24 meses BTE
  ('00000000-0000-0000-0000-000000000124', 'TETRA_HORARIO', 'PONTA', 0.06468),
  ('00000000-0000-0000-0000-000000000124', 'TETRA_HORARIO', 'CHEIA', 0.05589),
  ('00000000-0000-0000-0000-000000000124', 'TETRA_HORARIO', 'VAZIO', 0.08399),
  ('00000000-0000-0000-0000-000000000124', 'TETRA_HORARIO', 'SUPER_VAZIO', 0.08384),
  -- 24 meses MT
  ('00000000-0000-0000-0000-000000000125', 'TETRA_HORARIO', 'PONTA', 0.06268),
  ('00000000-0000-0000-0000-000000000125', 'TETRA_HORARIO', 'CHEIA', 0.05389),
  ('00000000-0000-0000-0000-000000000125', 'TETRA_HORARIO', 'VAZIO', 0.08199),
  ('00000000-0000-0000-0000-000000000125', 'TETRA_HORARIO', 'SUPER_VAZIO', 0.08184);

-- ============================================================================
-- Produtos Fechados BTN (estáticos, sem GO)
-- Ordem de prioridade de comissão (desempate): 1) ZC 2) Z 3) X 4) Deluxe+ 5) Deluxe
-- Comissão fixa por definir — deixada a null (editável só pelo Admin)
-- ============================================================================

insert into public.products (id, segmento, nome, tipo, prioridade_comissao, comissao_fixa, potencia_tabela_id, preco_estatico_com_tar, ativo) values
  ('00000000-0000-0000-0000-000000000200', 'BTN', 'X', 'FECHADO', 3, null, '00000000-0000-0000-0000-000000000010', true, true),
  ('00000000-0000-0000-0000-000000000201', 'BTN', 'Z', 'FECHADO', 2, null, '00000000-0000-0000-0000-000000000011', true, true),
  ('00000000-0000-0000-0000-000000000202', 'BTN', 'ZC', 'FECHADO', 1, null, '00000000-0000-0000-0000-000000000012', true, true),
  ('00000000-0000-0000-0000-000000000203', 'BTN', 'Deluxe', 'FECHADO', 5, null, '00000000-0000-0000-0000-000000000011', true, true),
  ('00000000-0000-0000-0000-000000000204', 'BTN', 'Deluxe+', 'FECHADO', 4, null, '00000000-0000-0000-0000-000000000012', true, true);

-- Preço fixo de energia com TAR incluída (€/kWh) — X / Z / ZC partilham valores; Deluxe / Deluxe+ partilham valores
insert into public.product_energy_prices (product_id, esquema_horario, periodo, preco_base)
select p.id, v.esquema_horario, v.periodo, v.preco
from public.products p
join (values
  ('X', 'SIMPLES', 'SIMPLES', 0.1597),
  ('X', 'BI_HORARIO', 'FORA_VAZIO', 0.1865),
  ('X', 'BI_HORARIO', 'VAZIO', 0.1108),
  ('X', 'TRI_HORARIO', 'PONTA', 0.3518),
  ('X', 'TRI_HORARIO', 'CHEIA', 0.1514),
  ('X', 'TRI_HORARIO', 'VAZIO', 0.107),
  ('Z', 'SIMPLES', 'SIMPLES', 0.1597),
  ('Z', 'BI_HORARIO', 'FORA_VAZIO', 0.1865),
  ('Z', 'BI_HORARIO', 'VAZIO', 0.1108),
  ('Z', 'TRI_HORARIO', 'PONTA', 0.3518),
  ('Z', 'TRI_HORARIO', 'CHEIA', 0.1514),
  ('Z', 'TRI_HORARIO', 'VAZIO', 0.107),
  ('ZC', 'SIMPLES', 'SIMPLES', 0.1597),
  ('ZC', 'BI_HORARIO', 'FORA_VAZIO', 0.1865),
  ('ZC', 'BI_HORARIO', 'VAZIO', 0.1108),
  ('ZC', 'TRI_HORARIO', 'PONTA', 0.3518),
  ('ZC', 'TRI_HORARIO', 'CHEIA', 0.1514),
  ('ZC', 'TRI_HORARIO', 'VAZIO', 0.107),
  ('Deluxe', 'SIMPLES', 'SIMPLES', 0.1427),
  ('Deluxe', 'BI_HORARIO', 'FORA_VAZIO', 0.1655),
  ('Deluxe', 'BI_HORARIO', 'VAZIO', 0.0978),
  ('Deluxe', 'TRI_HORARIO', 'PONTA', 0.3202),
  ('Deluxe', 'TRI_HORARIO', 'CHEIA', 0.1172),
  ('Deluxe', 'TRI_HORARIO', 'VAZIO', 0.0908),
  ('Deluxe+', 'SIMPLES', 'SIMPLES', 0.1427),
  ('Deluxe+', 'BI_HORARIO', 'FORA_VAZIO', 0.1655),
  ('Deluxe+', 'BI_HORARIO', 'VAZIO', 0.0978),
  ('Deluxe+', 'TRI_HORARIO', 'PONTA', 0.3202),
  ('Deluxe+', 'TRI_HORARIO', 'CHEIA', 0.1172),
  ('Deluxe+', 'TRI_HORARIO', 'VAZIO', 0.0908)
) as v(produto, esquema_horario, periodo, preco)
  on v.produto = p.nome
where p.tipo = 'FECHADO';
