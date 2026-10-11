-- ============================================================================
-- EnergyIT — pricing grid: allow a product to have both a PRECO formula and
-- a GO formula (pricing_formulas was 1 row per product; now up to 2, keyed
-- by tipo). No admin-bypass change — same catalog RLS as before.
-- ============================================================================

alter table public.pricing_formulas drop constraint pricing_formulas_product_id_key;

alter table public.pricing_formulas
  add column tipo text not null default 'PRECO' check (tipo in ('PRECO', 'GO'));

alter table public.pricing_formulas
  add constraint pricing_formulas_product_id_tipo_key unique (product_id, tipo);
