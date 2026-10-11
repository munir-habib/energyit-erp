-- O motor de simulação passa a trabalhar sobre o período faturado (nunca anualizado — ver
-- src/lib/pricingEngine.ts), por isso a simulação precisa de guardar o próprio período faturado
-- e o modo em que o preço atual foi introduzido, em vez de só o consumo já anualizado.

alter table public.simulations rename column consumo_anual_periodos to consumo_periodo;

alter table public.simulations
  add column dias_faturados int not null default 30,
  add column modo_preco_atual text not null default 'PERIODOS' check (modo_preco_atual in ('PERIODOS', 'TOTAL')),
  add column inclui_tar_atual boolean not null default true;
