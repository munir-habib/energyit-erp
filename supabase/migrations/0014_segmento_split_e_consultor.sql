-- Separa BTE_MT em dois segmentos verdadeiramente independentes: BTE e MT.
--
-- Até aqui, produtos/faturas/simulações/clientes BTE_MT partilhavam um único valor de `segmento`
-- e distinguiam-se por uma coluna `categoria_bte_mt` à parte — exatamente o padrão que já causou
-- (e já foi corrigido) o bug de misturar produtos BTE com produtos MT nas comparações (ver
-- 0013_add_categoria_bte_mt_to_products.sql). A partir desta migração, `segmento` sozinho já chega
-- para nunca misturar os dois: BTN, BTE e MT são três valores irmãos, tal como `tar_energia_bte_mt`
-- e `tar_potencia_bte_mt` já particionam por `categoria` (BTE/MT) desde sempre.
--
-- Não apaga nem duplica nenhum dado de catálogo: os produtos EZU/SuperNova inseridos em
-- 0011_ezu_supernova_real_data.sql só têm o valor de `segmento` reescrito de 'BTE_MT' para 'BTE'
-- ou 'MT' (usando o `categoria_bte_mt` que já tinham); preços, TAR e potência ficam intocados.
--
-- Também adiciona `clients.consultor_responsavel` — etiqueta organizacional livre, sem tabela nova
-- e sem alteração de RLS: a policy `clients_owner_all` já cobre qualquer coluna desta tabela.

-- ----------------------------------------------------------------------------
-- 1. products
-- ----------------------------------------------------------------------------
alter table public.products drop constraint if exists products_segmento_check;
update public.products set segmento = categoria_bte_mt where segmento = 'BTE_MT' and categoria_bte_mt is not null;
alter table public.products add constraint products_segmento_check check (segmento in ('BTN', 'BTE', 'MT', 'GAS'));
alter table public.products drop column if exists categoria_bte_mt;

-- ----------------------------------------------------------------------------
-- 2. invoices
-- ----------------------------------------------------------------------------
alter table public.invoices drop constraint if exists invoices_segmento_check;
update public.invoices set segmento = categoria_bte_mt where segmento = 'BTE_MT' and categoria_bte_mt is not null;
alter table public.invoices add constraint invoices_segmento_check check (segmento in ('BTN', 'BTE', 'MT', 'GAS'));
alter table public.invoices drop column if exists categoria_bte_mt;

-- ----------------------------------------------------------------------------
-- 3. simulations
-- ----------------------------------------------------------------------------
alter table public.simulations drop constraint if exists simulations_segmento_check;
update public.simulations set segmento = categoria_bte_mt where segmento = 'BTE_MT' and categoria_bte_mt is not null;
alter table public.simulations add constraint simulations_segmento_check check (segmento in ('BTN', 'BTE', 'MT', 'GAS'));
alter table public.simulations drop column if exists categoria_bte_mt;

-- ----------------------------------------------------------------------------
-- 4. clients — nunca teve categoria_bte_mt, por isso o valor real (BTE vs MT) de um cliente
--    'BTE_MT' existente é inferido da fatura ou simulação mais recente já migrada acima; sem
--    nenhuma das duas, assume 'BTE' por omissão. Revê esta parte antes de correr em produção se
--    tiveres clientes BTE_MT sem faturas/simulações associadas.
-- ----------------------------------------------------------------------------
alter table public.clients drop constraint if exists clients_segmento_principal_check;
update public.clients c
set segmento_principal = coalesce(
  (select i.segmento from public.invoices i where i.client_id = c.id and i.segmento in ('BTE', 'MT') order by i.created_at desc limit 1),
  (select s.segmento from public.simulations s where s.client_id = c.id and s.segmento in ('BTE', 'MT') order by s.created_at desc limit 1),
  'BTE'
)
where c.segmento_principal = 'BTE_MT';
alter table public.clients add constraint clients_segmento_principal_check check (segmento_principal in ('BTN', 'BTE', 'MT', 'GAS'));

alter table public.clients add column if not exists consultor_responsavel text;

-- ----------------------------------------------------------------------------
-- 5. potencia_contratada_tabelas — alargado por consistência; nenhuma linha existente usa BTE/MT
--    (o encargo de potência BTE/MT usa os coeficientes de tar_potencia_bte_mt, não uma tabela de
--    escalões).
-- ----------------------------------------------------------------------------
alter table public.potencia_contratada_tabelas drop constraint if exists potencia_contratada_tabelas_segmento_check;
alter table public.potencia_contratada_tabelas add constraint potencia_contratada_tabelas_segmento_check check (segmento in ('BTN', 'BTE', 'MT'));
