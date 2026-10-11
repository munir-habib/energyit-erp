-- ============================================================================
-- EnergyIT — reconstrução do catálogo EZU/SuperNova
--
-- Contexto: o catálogo tinha dados de demonstração do seed inicial (fornecedor
-- "Mercado Livre — Referência" e produtos "X"/"Deluxe" que não existem) por
-- baixo dos dados reais da EZU/SuperNova (0011). Este ficheiro:
--   1. Cria product_price_variants — cobre "período de validade com datas"
--      (EZU GO) e "prazo fixo sem datas" (SuperNova GO, Flex/BOOST/MAX) com a
--      mesma estrutura, e as colunas de product_energy_prices que a usam.
--   2. Remove o lixo (produtos demo, X, Deluxe, tabela de potência "X").
--   3. Substitui os produtos Abertos EZU/SuperNova antigos (sem variantes,
--      dados desatualizados) pela estrutura nova.
--   4. Adiciona os produtos novos (Plano BOOST, Plano MAX) e a variante de
--      24 meses do Plano Flex.
--
-- Não apaga nem recalcula Z, ZC, Deluxe+ — os preços e a tabela de potência já
-- em BD foram confirmados número a número contra os dados validados pelo
-- utilizador (só têm mais casas decimais). TAR (tar_energia_btn,
-- tar_potencia_btn, tar_energia_bte_mt, tar_potencia_bte_mt) também já bate
-- certo com os dados validados — nada é alterado aqui.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Schema: product_price_variants + colunas em product_energy_prices
-- ----------------------------------------------------------------------------

create table public.product_price_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  -- Prazo fixo sem datas (Flex/BOOST/MAX: 12|24; GO SuperNova: 12|18|24).
  duracao_meses int,
  -- Período de validade com datas (GO EZU) — data_inicio agrupa variantes no
  -- mesmo "grupo de início"; grupo_label/fim_label guardam o texto exato já
  -- validado ("Set/Out26", "Jun27"), nunca derivados das datas.
  data_inicio date,
  data_fim date,
  grupo_label text,
  fim_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index product_price_variants_product_idx on public.product_price_variants (product_id);

create trigger product_price_variants_set_updated_at
  before update on public.product_price_variants
  for each row execute function public.set_updated_at();

create trigger product_price_variants_audit
  after insert or update or delete on public.product_price_variants
  for each row execute function public.log_catalog_change();

alter table public.product_price_variants enable row level security;
create policy product_price_variants_read_all on public.product_price_variants for select using (auth.role() = 'authenticated');
create policy product_price_variants_write_admin on public.product_price_variants for insert with check (public.is_admin());
create policy product_price_variants_update_admin on public.product_price_variants for update using (public.is_admin());
create policy product_price_variants_delete_admin on public.product_price_variants for delete using (public.is_admin());

alter table public.product_energy_prices
  add column variant_id uuid references public.product_price_variants(id) on delete cascade,
  -- Só relevante para BTN Tri-Horário com preço por escalão de potência (Flex/BOOST/MAX).
  -- null = sem distinção de escalão — mesmo padrão já usado em tar_energia_btn.
  add column abaixo_20_7kva boolean;

-- Descobre o nome real da unique constraint original (product_id, esquema_horario, periodo) em vez
-- de assumir o nome gerado por omissão pelo Postgres — esta migração insere várias variantes com o
-- mesmo (esquema_horario, periodo) para o mesmo produto, por isso a constraint antiga TEM de sair
-- antes das inserções da secção 3 em diante, ou elas falham com violação de unicidade.
do $$
declare
  v_constraint_name text;
begin
  select con.conname into v_constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'product_energy_prices'
    and con.contype = 'u'
    and (select array_agg(k order by k) from unnest(con.conkey) as k) = (
      select array_agg(attnum order by attnum)
      from pg_attribute
      where attrelid = rel.oid and attname in ('product_id', 'esquema_horario', 'periodo')
    );
  if v_constraint_name is not null then
    execute format('alter table public.product_energy_prices drop constraint %I', v_constraint_name);
  end if;
end $$;

alter table public.product_energy_prices
  add constraint product_energy_prices_variant_esquema_periodo_key
  unique (product_id, variant_id, esquema_horario, periodo, abaixo_20_7kva);

-- ----------------------------------------------------------------------------
-- 2. Limpeza — remove dados de demonstração e produtos que não existem
-- ----------------------------------------------------------------------------

do $$
declare
  v_mercado_livre_id uuid;
begin
  delete from public.products where nome in ('X', 'Deluxe') and tipo = 'FECHADO';
  delete from public.potencia_contratada_tabelas where nome = 'X';
  update public.potencia_contratada_tabelas set nome = 'Z' where nome = 'Z / Deluxe';

  select id into v_mercado_livre_id from public.suppliers where nome = 'Mercado Livre — Referência';
  if v_mercado_livre_id is not null then
    delete from public.products where supplier_id = v_mercado_livre_id;
    delete from public.suppliers where id = v_mercado_livre_id;
  end if;

  -- EZU Aberto BTN/BTE/MT antigos (1 período só, valores desatualizados) — substituídos abaixo.
  delete from public.products
  where nome in ('EZU — Aberto BTN (Set26/Jun27)', 'EZU — Aberto BTE (Set26/Jun27)', 'EZU — Aberto MT (Set26/Jun27)');

  -- SuperNova Plano Flex antigo (só 12 meses, variante >20,7kVA como produto à parte) — substituído abaixo.
  delete from public.products where nome in ('Plano Flex', 'Plano Flex (>20,7 kVA)');

  -- SuperNova Aberto BTE/MT antigos (6 produtos por duração, sem estrutura de variantes) — substituídos abaixo.
  delete from public.products where nome like 'SuperNova — Aberto %';
end $$;

-- ----------------------------------------------------------------------------
-- 3. EZU — BTN GO, BTE GO, MT GO (produtos Abertos com períodos de validade)
-- ----------------------------------------------------------------------------

do $$
declare
  v_ezu_id uuid;
  v_ezu_potencia_excecao_id uuid;
  v_prod_btn uuid;
  v_prod_bte uuid;
  v_prod_mt uuid;
  v_var uuid;
  -- (grupo_label, fim_label, data_inicio, data_fim,
  --  btn_simples, btn_bi_vazio, btn_bi_fora_vazio, btn_tri_ponta, btn_tri_cheia, btn_tri_vazio,
  --  bte_ponta, bte_cheia, bte_vazio, bte_svazio,
  --  mt_ponta, mt_cheia, mt_vazio, mt_svazio)
  v_periodos jsonb := '[
    ["Set/Out26","Jun27","2026-09-01","2027-06-30",0.1144,0.1121,0.1168,0.1224,0.1038,0.1169,0.1060,0.1006,0.1272,0.1277,0.1037,0.0985,0.1254,0.1260],
    ["Set/Out26","Jun28","2026-09-01","2028-06-30",0.1000,0.0978,0.1040,0.1079,0.0897,0.1024,0.0916,0.0862,0.1129,0.1133,0.0905,0.0843,0.1101,0.1112],
    ["Set/Out26","Jun29","2026-09-01","2029-06-30",0.0933,0.0899,0.0967,0.1014,0.0865,0.0919,0.0845,0.0792,0.1057,0.1078,0.0831,0.0772,0.1042,0.1049],
    ["Jan27","Dez27","2027-01-01","2027-12-31",0.0959,0.0922,0.0996,0.1001,0.0894,0.0981,0.0875,0.0821,0.1088,0.1092,0.0853,0.0813,0.1054,0.1076],
    ["Jan27","Jun28","2027-01-01","2028-06-30",0.0872,0.0855,0.0889,0.0946,0.0769,0.0902,0.0789,0.0733,0.0997,0.1009,0.0767,0.0709,0.0981,0.0991],
    ["Jan27","Dez28","2027-01-01","2028-12-31",0.0888,0.0855,0.0921,0.0951,0.0799,0.0913,0.0805,0.0749,0.1013,0.1025,0.0783,0.0725,0.0997,0.1007],
    ["Jan27","Jun29","2027-01-01","2029-06-30",0.0827,0.0798,0.0856,0.0906,0.0699,0.0876,0.0741,0.0699,0.0946,0.0962,0.0722,0.0664,0.0936,0.0946],
    ["Jan27","Dez29","2027-01-01","2029-12-31",0.0845,0.0823,0.0867,0.0924,0.0717,0.0894,0.0762,0.0701,0.0975,0.0982,0.0740,0.0686,0.0955,0.0959],
    ["Jan27","Jun30","2027-01-01","2030-06-30",0.0789,0.0760,0.0818,0.0868,0.0661,0.0838,0.0699,0.0652,0.0920,0.0925,0.0679,0.0619,0.0898,0.0916]
  ]'::jsonb;
  v_row jsonb;
begin
  select id into v_ezu_id from public.suppliers where nome = 'EZU';
  select id into v_ezu_potencia_excecao_id from public.potencia_contratada_tabelas where nome = 'EZU — Aberto BTN (tabela antiga, exceção)';

  insert into public.products (segmento, supplier_id, nome, tipo, go_valor, potencia_tabela_id, preco_estatico_com_tar, ativo)
  values ('BTN', v_ezu_id, 'BTN GO', 'ABERTO_FIXO', 10, v_ezu_potencia_excecao_id, false, true)
  returning id into v_prod_btn;

  insert into public.products (segmento, supplier_id, nome, tipo, go_valor, preco_estatico_com_tar, ativo)
  values ('BTE', v_ezu_id, 'BTE GO', 'ABERTO_FIXO', 10, false, true)
  returning id into v_prod_bte;

  insert into public.products (segmento, supplier_id, nome, tipo, go_valor, preco_estatico_com_tar, ativo)
  values ('MT', v_ezu_id, 'MT GO', 'ABERTO_FIXO', 10, false, true)
  returning id into v_prod_mt;

  for v_row in select * from jsonb_array_elements(v_periodos)
  loop
    insert into public.product_price_variants (product_id, grupo_label, fim_label, data_inicio, data_fim)
    values (v_prod_btn, v_row->>0, v_row->>1, (v_row->>2)::date, (v_row->>3)::date)
    returning id into v_var;
    insert into public.product_energy_prices (product_id, variant_id, esquema_horario, periodo, preco_base) values
      (v_prod_btn, v_var, 'SIMPLES', 'SIMPLES', (v_row->>4)::numeric),
      (v_prod_btn, v_var, 'BI_HORARIO', 'VAZIO', (v_row->>5)::numeric),
      (v_prod_btn, v_var, 'BI_HORARIO', 'FORA_VAZIO', (v_row->>6)::numeric),
      (v_prod_btn, v_var, 'TRI_HORARIO', 'PONTA', (v_row->>7)::numeric),
      (v_prod_btn, v_var, 'TRI_HORARIO', 'CHEIA', (v_row->>8)::numeric),
      (v_prod_btn, v_var, 'TRI_HORARIO', 'VAZIO', (v_row->>9)::numeric);

    insert into public.product_price_variants (product_id, grupo_label, fim_label, data_inicio, data_fim)
    values (v_prod_bte, v_row->>0, v_row->>1, (v_row->>2)::date, (v_row->>3)::date)
    returning id into v_var;
    insert into public.product_energy_prices (product_id, variant_id, esquema_horario, periodo, preco_base) values
      (v_prod_bte, v_var, 'TETRA_HORARIO', 'PONTA', (v_row->>10)::numeric),
      (v_prod_bte, v_var, 'TETRA_HORARIO', 'CHEIA', (v_row->>11)::numeric),
      (v_prod_bte, v_var, 'TETRA_HORARIO', 'VAZIO', (v_row->>12)::numeric),
      (v_prod_bte, v_var, 'TETRA_HORARIO', 'SUPER_VAZIO', (v_row->>13)::numeric);

    insert into public.product_price_variants (product_id, grupo_label, fim_label, data_inicio, data_fim)
    values (v_prod_mt, v_row->>0, v_row->>1, (v_row->>2)::date, (v_row->>3)::date)
    returning id into v_var;
    insert into public.product_energy_prices (product_id, variant_id, esquema_horario, periodo, preco_base) values
      (v_prod_mt, v_var, 'TETRA_HORARIO', 'PONTA', (v_row->>14)::numeric),
      (v_prod_mt, v_var, 'TETRA_HORARIO', 'CHEIA', (v_row->>15)::numeric),
      (v_prod_mt, v_var, 'TETRA_HORARIO', 'VAZIO', (v_row->>16)::numeric),
      (v_prod_mt, v_var, 'TETRA_HORARIO', 'SUPER_VAZIO', (v_row->>17)::numeric);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 4. SuperNova — Plano Flex / BOOST / MAX (Fechados, com duração 12|24 meses)
-- ----------------------------------------------------------------------------

do $$
declare
  v_supernova_id uuid;
  v_flex_potencia_id uuid;
  v_boost_potencia_id uuid;
  v_max_potencia_id uuid;
  v_prod uuid;
  v_var uuid;
  -- (nome, potencia_tabela_id resolvido depois,
  --  [duracao, simples, bi_fv, bi_vazio, tri20_ponta, tri20_cheia, tri20_vazio, tri20mais_ponta, tri20mais_cheia, tri20mais_vazio][])
  v_planos jsonb := '[
    {"nome":"Plano Flex","variantes":[
      [12,0.1463,0.1603,0.1104,0.3306,0.1244,0.1047,0.3311,0.1356,0.1039],
      [24,0.1546,0.1670,0.1204,0.3388,0.1322,0.1136,0.3393,0.1434,0.1128]
    ]},
    {"nome":"Plano BOOST","variantes":[
      [12,0.1493,0.1633,0.1134,0.3336,0.1274,0.1077,0.3341,0.1386,0.1069],
      [24,0.1573,0.1697,0.1231,0.3415,0.1349,0.1163,0.3420,0.1461,0.1155]
    ]},
    {"nome":"Plano MAX","variantes":[
      [12,0.1563,0.1703,0.1204,0.3406,0.1344,0.1147,0.3411,0.1456,0.1139],
      [24,0.1646,0.1770,0.1304,0.3488,0.1422,0.1236,0.3493,0.1534,0.1228]
    ]}
  ]'::jsonb;
  v_plano jsonb;
  v_row jsonb;
begin
  select id into v_supernova_id from public.suppliers where nome = 'SuperNova';
  select id into v_flex_potencia_id from public.potencia_contratada_tabelas where nome = 'SuperNova — Plano Flex';

  insert into public.potencia_contratada_tabelas (nome, segmento) values ('SuperNova — Plano BOOST', 'BTN') returning id into v_boost_potencia_id;
  insert into public.potencia_contratada_valores (tabela_id, potencia_kva, valor_dia) values
    (v_boost_potencia_id, 1.15, 0.2573), (v_boost_potencia_id, 2.3, 0.3445), (v_boost_potencia_id, 3.45, 0.5218),
    (v_boost_potencia_id, 4.6, 0.5991), (v_boost_potencia_id, 5.75, 0.6664), (v_boost_potencia_id, 6.9, 0.7436),
    (v_boost_potencia_id, 10.35, 0.9654), (v_boost_potencia_id, 13.8, 1.1472), (v_boost_potencia_id, 17.25, 1.3291),
    (v_boost_potencia_id, 20.7, 1.5109), (v_boost_potencia_id, 27.6, 1.9748), (v_boost_potencia_id, 34.5, 2.3160),
    (v_boost_potencia_id, 41.4, 2.6572);

  insert into public.potencia_contratada_tabelas (nome, segmento) values ('SuperNova — Plano MAX', 'BTN') returning id into v_max_potencia_id;
  insert into public.potencia_contratada_valores (tabela_id, potencia_kva, valor_dia) values
    (v_max_potencia_id, 1.15, 0.3773), (v_max_potencia_id, 2.3, 0.4825), (v_max_potencia_id, 3.45, 0.7318),
    (v_max_potencia_id, 4.6, 0.8211), (v_max_potencia_id, 5.75, 0.8944), (v_max_potencia_id, 6.9, 0.9836),
    (v_max_potencia_id, 10.35, 1.2354), (v_max_potencia_id, 13.8, 1.4232), (v_max_potencia_id, 17.25, 1.6111),
    (v_max_potencia_id, 20.7, 1.7989), (v_max_potencia_id, 27.6, 2.3648), (v_max_potencia_id, 34.5, 2.7120),
    (v_max_potencia_id, 41.4, 3.0592);

  for v_plano in select * from jsonb_array_elements(v_planos)
  loop
    insert into public.products (segmento, supplier_id, nome, tipo, preco_estatico_com_tar, ativo, potencia_tabela_id)
    values (
      'BTN', v_supernova_id, v_plano->>'nome', 'FECHADO', true, true,
      case v_plano->>'nome'
        when 'Plano Flex' then v_flex_potencia_id
        when 'Plano BOOST' then v_boost_potencia_id
        else v_max_potencia_id
      end
    )
    returning id into v_prod;

    for v_row in select * from jsonb_array_elements(v_plano->'variantes')
    loop
      insert into public.product_price_variants (product_id, duracao_meses) values (v_prod, (v_row->>0)::int) returning id into v_var;
      insert into public.product_energy_prices (product_id, variant_id, esquema_horario, periodo, abaixo_20_7kva, preco_base) values
        (v_prod, v_var, 'SIMPLES', 'SIMPLES', null, (v_row->>1)::numeric),
        (v_prod, v_var, 'BI_HORARIO', 'FORA_VAZIO', null, (v_row->>2)::numeric),
        (v_prod, v_var, 'BI_HORARIO', 'VAZIO', null, (v_row->>3)::numeric),
        (v_prod, v_var, 'TRI_HORARIO', 'PONTA', true, (v_row->>4)::numeric),
        (v_prod, v_var, 'TRI_HORARIO', 'CHEIA', true, (v_row->>5)::numeric),
        (v_prod, v_var, 'TRI_HORARIO', 'VAZIO', true, (v_row->>6)::numeric),
        (v_prod, v_var, 'TRI_HORARIO', 'PONTA', false, (v_row->>7)::numeric),
        (v_prod, v_var, 'TRI_HORARIO', 'CHEIA', false, (v_row->>8)::numeric),
        (v_prod, v_var, 'TRI_HORARIO', 'VAZIO', false, (v_row->>9)::numeric);
    end loop;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 5. SuperNova — BTE GO / MT GO (Abertos, prazo fixo 12|18|24 meses, sem datas)
-- ----------------------------------------------------------------------------

do $$
declare
  v_supernova_id uuid;
  v_prod_bte uuid;
  v_prod_mt uuid;
  v_var uuid;
  -- (duracao, bte_ponta, bte_cheia, bte_vazio, bte_svazio, mt_ponta, mt_cheia, mt_vazio, mt_svazio)
  v_prazos jsonb := '[
    [12,0.0805,0.0820,0.0891,0.0836,0.0814,0.0842,0.0806,0.0835],
    [18,0.0758,0.0772,0.0839,0.0787,0.0766,0.0792,0.0759,0.0786],
    [24,0.0728,0.0741,0.0805,0.0755,0.0736,0.0760,0.0728,0.0754]
  ]'::jsonb;
  v_row jsonb;
begin
  select id into v_supernova_id from public.suppliers where nome = 'SuperNova';

  insert into public.products (segmento, supplier_id, nome, tipo, go_valor, preco_estatico_com_tar, ativo)
  values ('BTE', v_supernova_id, 'BTE GO', 'ABERTO_FIXO', 10, false, true)
  returning id into v_prod_bte;

  insert into public.products (segmento, supplier_id, nome, tipo, go_valor, preco_estatico_com_tar, ativo)
  values ('MT', v_supernova_id, 'MT GO', 'ABERTO_FIXO', 10, false, true)
  returning id into v_prod_mt;

  for v_row in select * from jsonb_array_elements(v_prazos)
  loop
    insert into public.product_price_variants (product_id, duracao_meses) values (v_prod_bte, (v_row->>0)::int) returning id into v_var;
    insert into public.product_energy_prices (product_id, variant_id, esquema_horario, periodo, preco_base) values
      (v_prod_bte, v_var, 'TETRA_HORARIO', 'PONTA', (v_row->>1)::numeric),
      (v_prod_bte, v_var, 'TETRA_HORARIO', 'CHEIA', (v_row->>2)::numeric),
      (v_prod_bte, v_var, 'TETRA_HORARIO', 'VAZIO', (v_row->>3)::numeric),
      (v_prod_bte, v_var, 'TETRA_HORARIO', 'SUPER_VAZIO', (v_row->>4)::numeric);

    insert into public.product_price_variants (product_id, duracao_meses) values (v_prod_mt, (v_row->>0)::int) returning id into v_var;
    insert into public.product_energy_prices (product_id, variant_id, esquema_horario, periodo, preco_base) values
      (v_prod_mt, v_var, 'TETRA_HORARIO', 'PONTA', (v_row->>5)::numeric),
      (v_prod_mt, v_var, 'TETRA_HORARIO', 'CHEIA', (v_row->>6)::numeric),
      (v_prod_mt, v_var, 'TETRA_HORARIO', 'VAZIO', (v_row->>7)::numeric),
      (v_prod_mt, v_var, 'TETRA_HORARIO', 'SUPER_VAZIO', (v_row->>8)::numeric);
  end loop;
end $$;
