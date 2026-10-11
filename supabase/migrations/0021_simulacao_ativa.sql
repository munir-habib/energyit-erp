-- Revisão da regra "1 por CPE": uma CPE passa a poder ter várias simulações (histórico/rascunhos,
-- via "Duplicar simulação"), mas só 1 pode estar marcada como ativa de cada vez — essa é que aparece
-- na ficha do cliente e é usada nos documentos. Substitui o índice único total pelo parcial abaixo.
drop index if exists public.simulations_ponto_consumo_unique_idx;

alter table public.simulations add column ativa boolean not null default true;

create unique index simulations_ponto_consumo_ativa_idx
  on public.simulations (ponto_consumo_id)
  where ativa = true and ponto_consumo_id is not null;

-- Inputs em bruto do formulário — antes só ficavam derivados dentro de "resultados" (já calculados),
-- nunca guardados à parte. Precisos para "Duplicar simulação" conseguir reabrir o formulário de
-- edição com os valores originais (potência, preço atual, GO), e para o detalhe por período do
-- Documento do Cliente conseguir mostrar o preço atual por período (não só a média).
alter table public.simulations
  add column potencia_contratada_kva numeric,
  add column preco_atual_periodos jsonb,
  add column valor_total_periodo numeric,
  add column go_override numeric;
