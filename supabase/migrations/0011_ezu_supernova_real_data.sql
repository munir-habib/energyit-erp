-- Dados reais e confirmados da EZU e da SuperNova (produtos, preços, TAR, potência).
-- Corrige registos parciais de uma tentativa anterior em vez de os duplicar:
--   - products Z, ZC, Deluxe+ já existiam sem comercializadora associada e com preços de
--     energia placeholder — aqui só se relinka a EZU e corrigem-se os preços.
--   - tar_potencia_btn (tabela oficial/transversal) tinha, por engano, os valores da
--     exceção EZU — aqui corrige-se para os valores oficiais e a exceção passa a viver
--     na sua própria tabela em potencia_contratada_tabelas/valores.
-- X e Deluxe não são tocados — dados ainda por confirmar.

do $$
declare
  v_ezu_id uuid;
  v_supernova_id uuid;
  v_ezu_aberto_btn_potencia_id uuid;
  v_supernova_flex_potencia_id uuid;
  v_prod_id uuid;
begin
  -- 1. Comercializadoras
  insert into suppliers (nome, contactos, condicoes) values ('EZU', null, null) returning id into v_ezu_id;
  insert into suppliers (nome, contactos, condicoes) values ('SuperNova', null, null) returning id into v_supernova_id;

  -- 2. Corrige a TAR de Potência BTN oficial/transversal
  update tar_potencia_btn set valor_dia = case potencia_kva
    when 1.15 then 0.0573
    when 2.3 then 0.1145
    when 3.45 then 0.1718
    when 4.6 then 0.2291
    when 5.75 then 0.2864
    when 6.9 then 0.3436
    when 10.35 then 0.5154
    when 13.8 then 0.6872
    when 17.25 then 0.8591
    when 20.7 then 1.0309
    when 27.6 then 1.3248
    when 34.5 then 1.8560
    when 41.4 then 1.9872
    else valor_dia
  end;

  -- 3. Tabela de Potência própria para a exceção EZU Aberto BTN (valores antigos, por pedido explícito)
  insert into potencia_contratada_tabelas (nome, segmento) values ('EZU — Aberto BTN (tabela antiga, exceção)', 'BTN') returning id into v_ezu_aberto_btn_potencia_id;
  insert into potencia_contratada_valores (tabela_id, potencia_kva, valor_dia) values
    (v_ezu_aberto_btn_potencia_id, 1.15, 0.1637),
    (v_ezu_aberto_btn_potencia_id, 2.3, 0.235),
    (v_ezu_aberto_btn_potencia_id, 3.45, 0.2595),
    (v_ezu_aberto_btn_potencia_id, 4.6, 0.3261),
    (v_ezu_aberto_btn_potencia_id, 5.75, 0.3927),
    (v_ezu_aberto_btn_potencia_id, 6.9, 0.4592),
    (v_ezu_aberto_btn_potencia_id, 10.35, 0.6318),
    (v_ezu_aberto_btn_potencia_id, 13.8, 0.8224),
    (v_ezu_aberto_btn_potencia_id, 17.25, 1.0131),
    (v_ezu_aberto_btn_potencia_id, 20.7, 1.2036),
    (v_ezu_aberto_btn_potencia_id, 27.6, 1.5627),
    (v_ezu_aberto_btn_potencia_id, 34.5, 1.9384),
    (v_ezu_aberto_btn_potencia_id, 41.4, 2.3141);

  -- 4. Tabela de Potência da SuperNova (Plano Flex) — valor exato da SuperNova, nunca ajustado
  insert into potencia_contratada_tabelas (nome, segmento) values ('SuperNova — Plano Flex', 'BTN') returning id into v_supernova_flex_potencia_id;
  insert into potencia_contratada_valores (tabela_id, potencia_kva, valor_dia) values
    (v_supernova_flex_potencia_id, 1.15, 0.0873),
    (v_supernova_flex_potencia_id, 2.3, 0.1490),
    (v_supernova_flex_potencia_id, 3.45, 0.2243),
    (v_supernova_flex_potencia_id, 4.6, 0.2846),
    (v_supernova_flex_potencia_id, 5.75, 0.3434),
    (v_supernova_flex_potencia_id, 6.9, 0.4036),
    (v_supernova_flex_potencia_id, 10.35, 0.5829),
    (v_supernova_flex_potencia_id, 13.8, 0.7562),
    (v_supernova_flex_potencia_id, 17.25, 0.9296),
    (v_supernova_flex_potencia_id, 20.7, 1.1029),
    (v_supernova_flex_potencia_id, 27.6, 1.4223),
    (v_supernova_flex_potencia_id, 34.5, 1.7550),
    (v_supernova_flex_potencia_id, 41.4, 2.0877);

  -- 5. EZU Fechados já existentes (Z, ZC, Deluxe+) — corrige em vez de duplicar
  update products set supplier_id = v_ezu_id where id = '00000000-0000-0000-0000-000000000201'; -- Z
  update products set supplier_id = v_ezu_id where id = '00000000-0000-0000-0000-000000000202'; -- ZC
  update products set supplier_id = v_ezu_id where id = '00000000-0000-0000-0000-000000000204'; -- Deluxe+

  update product_energy_prices set preco_base = 0.1697 where product_id = '00000000-0000-0000-0000-000000000201' and esquema_horario='SIMPLES' and periodo='SIMPLES';
  update product_energy_prices set preco_base = 0.1925 where product_id = '00000000-0000-0000-0000-000000000201' and esquema_horario='BI_HORARIO' and periodo='FORA_VAZIO';
  update product_energy_prices set preco_base = 0.1248 where product_id = '00000000-0000-0000-0000-000000000201' and esquema_horario='BI_HORARIO' and periodo='VAZIO';
  update product_energy_prices set preco_base = 0.3547 where product_id = '00000000-0000-0000-0000-000000000201' and esquema_horario='TRI_HORARIO' and periodo='PONTA';
  update product_energy_prices set preco_base = 0.1614 where product_id = '00000000-0000-0000-0000-000000000201' and esquema_horario='TRI_HORARIO' and periodo='CHEIA';
  update product_energy_prices set preco_base = 0.1240 where product_id = '00000000-0000-0000-0000-000000000201' and esquema_horario='TRI_HORARIO' and periodo='VAZIO';

  update product_energy_prices set preco_base = 0.1697 where product_id = '00000000-0000-0000-0000-000000000202' and esquema_horario='SIMPLES' and periodo='SIMPLES';
  update product_energy_prices set preco_base = 0.1925 where product_id = '00000000-0000-0000-0000-000000000202' and esquema_horario='BI_HORARIO' and periodo='FORA_VAZIO';
  update product_energy_prices set preco_base = 0.1248 where product_id = '00000000-0000-0000-0000-000000000202' and esquema_horario='BI_HORARIO' and periodo='VAZIO';
  update product_energy_prices set preco_base = 0.3547 where product_id = '00000000-0000-0000-0000-000000000202' and esquema_horario='TRI_HORARIO' and periodo='PONTA';
  update product_energy_prices set preco_base = 0.1614 where product_id = '00000000-0000-0000-0000-000000000202' and esquema_horario='TRI_HORARIO' and periodo='CHEIA';
  update product_energy_prices set preco_base = 0.1240 where product_id = '00000000-0000-0000-0000-000000000202' and esquema_horario='TRI_HORARIO' and periodo='VAZIO';

  update product_energy_prices set preco_base = 0.1600 where product_id = '00000000-0000-0000-0000-000000000204' and esquema_horario='SIMPLES' and periodo='SIMPLES';
  update product_energy_prices set preco_base = 0.1828 where product_id = '00000000-0000-0000-0000-000000000204' and esquema_horario='BI_HORARIO' and periodo='FORA_VAZIO';
  update product_energy_prices set preco_base = 0.1151 where product_id = '00000000-0000-0000-0000-000000000204' and esquema_horario='BI_HORARIO' and periodo='VAZIO';
  update product_energy_prices set preco_base = 0.3450 where product_id = '00000000-0000-0000-0000-000000000204' and esquema_horario='TRI_HORARIO' and periodo='PONTA';
  update product_energy_prices set preco_base = 0.1517 where product_id = '00000000-0000-0000-0000-000000000204' and esquema_horario='TRI_HORARIO' and periodo='CHEIA';
  update product_energy_prices set preco_base = 0.1143 where product_id = '00000000-0000-0000-0000-000000000204' and esquema_horario='TRI_HORARIO' and periodo='VAZIO';

  -- 6. EZU Aberto BTN (Set26/Jun27, não depende da duração)
  insert into products (segmento, supplier_id, nome, tipo, duracao_meses, go_valor, preco_limite, potencia_tabela_id, preco_estatico_com_tar, ativo)
  values ('BTN', v_ezu_id, 'EZU — Aberto BTN (Set26/Jun27)', 'ABERTO_FIXO', null, null, null, v_ezu_aberto_btn_potencia_id, false, true)
  returning id into v_prod_id;
  insert into product_energy_prices (product_id, esquema_horario, periodo, preco_base) values
    (v_prod_id, 'SIMPLES', 'SIMPLES', 0.109),
    (v_prod_id, 'BI_HORARIO', 'FORA_VAZIO', 0.1148),
    (v_prod_id, 'BI_HORARIO', 'VAZIO', 0.1099),
    (v_prod_id, 'TRI_HORARIO', 'PONTA', 0.1199),
    (v_prod_id, 'TRI_HORARIO', 'CHEIA', 0.1022),
    (v_prod_id, 'TRI_HORARIO', 'VAZIO', 0.1149);

  -- 7. EZU Aberto BTE&MT (Set26/Jun27) — um produto por categoria
  insert into products (segmento, supplier_id, nome, tipo, duracao_meses, go_valor, preco_limite, preco_estatico_com_tar, ativo)
  values ('BTE_MT', v_ezu_id, 'EZU — Aberto BTE (Set26/Jun27)', 'ABERTO_FIXO', null, null, null, false, true)
  returning id into v_prod_id;
  insert into product_energy_prices (product_id, esquema_horario, periodo, preco_base) values
    (v_prod_id, 'TETRA_HORARIO', 'PONTA', 0.1006),
    (v_prod_id, 'TETRA_HORARIO', 'CHEIA', 0.0952),
    (v_prod_id, 'TETRA_HORARIO', 'VAZIO', 0.1219),
    (v_prod_id, 'TETRA_HORARIO', 'SUPER_VAZIO', 0.1223);

  insert into products (segmento, supplier_id, nome, tipo, duracao_meses, go_valor, preco_limite, preco_estatico_com_tar, ativo)
  values ('BTE_MT', v_ezu_id, 'EZU — Aberto MT (Set26/Jun27)', 'ABERTO_FIXO', null, null, null, false, true)
  returning id into v_prod_id;
  insert into product_energy_prices (product_id, esquema_horario, periodo, preco_base) values
    (v_prod_id, 'TETRA_HORARIO', 'PONTA', 0.0984),
    (v_prod_id, 'TETRA_HORARIO', 'CHEIA', 0.0942),
    (v_prod_id, 'TETRA_HORARIO', 'VAZIO', 0.1187),
    (v_prod_id, 'TETRA_HORARIO', 'SUPER_VAZIO', 0.1207);

  -- 8. SuperNova Plano Flex (Fechado, só 12 meses)
  insert into products (segmento, supplier_id, nome, tipo, duracao_meses, go_valor, preco_limite, comissao_fixa, prioridade_comissao, potencia_tabela_id, preco_estatico_com_tar, ativo)
  values ('BTN', v_supernova_id, 'Plano Flex', 'FECHADO', 12, null, null, null, null, v_supernova_flex_potencia_id, true, true)
  returning id into v_prod_id;
  insert into product_energy_prices (product_id, esquema_horario, periodo, preco_base) values
    (v_prod_id, 'SIMPLES', 'SIMPLES', 0.1463),
    (v_prod_id, 'BI_HORARIO', 'FORA_VAZIO', 0.1603),
    (v_prod_id, 'BI_HORARIO', 'VAZIO', 0.1104),
    (v_prod_id, 'TRI_HORARIO', 'PONTA', 0.3306),
    (v_prod_id, 'TRI_HORARIO', 'CHEIA', 0.1244),
    (v_prod_id, 'TRI_HORARIO', 'VAZIO', 0.1047);

  -- 8b. Variante do Plano Flex para escalões >20,7 kVA (Tri-Horário tem preço diferente nesse escalão;
  --     Simples/Bi-Horário não estão disponíveis nesses escalões). O schema atual não modela um preço
  --     de energia por banda de potência dentro do mesmo produto, por isso esta variante cobre só o
  --     Tri-Horário do escalão superior; a potência usa a mesma tabela (os valores por kVA não mudam).
  insert into products (segmento, supplier_id, nome, tipo, duracao_meses, go_valor, preco_limite, comissao_fixa, prioridade_comissao, potencia_tabela_id, preco_estatico_com_tar, ativo)
  values ('BTN', v_supernova_id, 'Plano Flex (>20,7 kVA)', 'FECHADO', 12, null, null, null, null, v_supernova_flex_potencia_id, true, true)
  returning id into v_prod_id;
  insert into product_energy_prices (product_id, esquema_horario, periodo, preco_base) values
    (v_prod_id, 'TRI_HORARIO', 'PONTA', 0.3311),
    (v_prod_id, 'TRI_HORARIO', 'CHEIA', 0.1356),
    (v_prod_id, 'TRI_HORARIO', 'VAZIO', 0.1039);

  -- 9. SuperNova Aberto BTE&MT por duração (12/18/24 meses × BTE/MT)
  insert into products (segmento, supplier_id, nome, tipo, duracao_meses, go_valor, preco_limite, preco_estatico_com_tar, ativo)
  values ('BTE_MT', v_supernova_id, 'SuperNova — Aberto BTE 12 meses', 'ABERTO_FIXO', 12, null, null, false, true)
  returning id into v_prod_id;
  insert into product_energy_prices (product_id, esquema_horario, periodo, preco_base) values
    (v_prod_id, 'TETRA_HORARIO', 'PONTA', 0.0805),
    (v_prod_id, 'TETRA_HORARIO', 'CHEIA', 0.0820),
    (v_prod_id, 'TETRA_HORARIO', 'VAZIO', 0.0891),
    (v_prod_id, 'TETRA_HORARIO', 'SUPER_VAZIO', 0.0836);

  insert into products (segmento, supplier_id, nome, tipo, duracao_meses, go_valor, preco_limite, preco_estatico_com_tar, ativo)
  values ('BTE_MT', v_supernova_id, 'SuperNova — Aberto MT 12 meses', 'ABERTO_FIXO', 12, null, null, false, true)
  returning id into v_prod_id;
  insert into product_energy_prices (product_id, esquema_horario, periodo, preco_base) values
    (v_prod_id, 'TETRA_HORARIO', 'PONTA', 0.0814),
    (v_prod_id, 'TETRA_HORARIO', 'CHEIA', 0.0842),
    (v_prod_id, 'TETRA_HORARIO', 'VAZIO', 0.0806),
    (v_prod_id, 'TETRA_HORARIO', 'SUPER_VAZIO', 0.0835);

  insert into products (segmento, supplier_id, nome, tipo, duracao_meses, go_valor, preco_limite, preco_estatico_com_tar, ativo)
  values ('BTE_MT', v_supernova_id, 'SuperNova — Aberto BTE 18 meses', 'ABERTO_FIXO', 18, null, null, false, true)
  returning id into v_prod_id;
  insert into product_energy_prices (product_id, esquema_horario, periodo, preco_base) values
    (v_prod_id, 'TETRA_HORARIO', 'PONTA', 0.0758),
    (v_prod_id, 'TETRA_HORARIO', 'CHEIA', 0.0772),
    (v_prod_id, 'TETRA_HORARIO', 'VAZIO', 0.0839),
    (v_prod_id, 'TETRA_HORARIO', 'SUPER_VAZIO', 0.0787);

  insert into products (segmento, supplier_id, nome, tipo, duracao_meses, go_valor, preco_limite, preco_estatico_com_tar, ativo)
  values ('BTE_MT', v_supernova_id, 'SuperNova — Aberto MT 18 meses', 'ABERTO_FIXO', 18, null, null, false, true)
  returning id into v_prod_id;
  insert into product_energy_prices (product_id, esquema_horario, periodo, preco_base) values
    (v_prod_id, 'TETRA_HORARIO', 'PONTA', 0.0766),
    (v_prod_id, 'TETRA_HORARIO', 'CHEIA', 0.0792),
    (v_prod_id, 'TETRA_HORARIO', 'VAZIO', 0.0759),
    (v_prod_id, 'TETRA_HORARIO', 'SUPER_VAZIO', 0.0786);

  insert into products (segmento, supplier_id, nome, tipo, duracao_meses, go_valor, preco_limite, preco_estatico_com_tar, ativo)
  values ('BTE_MT', v_supernova_id, 'SuperNova — Aberto BTE 24 meses', 'ABERTO_FIXO', 24, null, null, false, true)
  returning id into v_prod_id;
  insert into product_energy_prices (product_id, esquema_horario, periodo, preco_base) values
    (v_prod_id, 'TETRA_HORARIO', 'PONTA', 0.0728),
    (v_prod_id, 'TETRA_HORARIO', 'CHEIA', 0.0741),
    (v_prod_id, 'TETRA_HORARIO', 'VAZIO', 0.0805),
    (v_prod_id, 'TETRA_HORARIO', 'SUPER_VAZIO', 0.0755);

  insert into products (segmento, supplier_id, nome, tipo, duracao_meses, go_valor, preco_limite, preco_estatico_com_tar, ativo)
  values ('BTE_MT', v_supernova_id, 'SuperNova — Aberto MT 24 meses', 'ABERTO_FIXO', 24, null, null, false, true)
  returning id into v_prod_id;
  insert into product_energy_prices (product_id, esquema_horario, periodo, preco_base) values
    (v_prod_id, 'TETRA_HORARIO', 'PONTA', 0.0736),
    (v_prod_id, 'TETRA_HORARIO', 'CHEIA', 0.0760),
    (v_prod_id, 'TETRA_HORARIO', 'VAZIO', 0.0728),
    (v_prod_id, 'TETRA_HORARIO', 'SUPER_VAZIO', 0.0754);

end $$;
