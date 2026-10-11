-- 1 simulação (ativa) por CPE: uma CPE nunca pode ter duas simulações associadas.
-- Simulações "à solta" (ponto_consumo_id null) não são limitadas.
create unique index simulations_ponto_consumo_unique_idx
  on public.simulations (ponto_consumo_id)
  where ponto_consumo_id is not null;
