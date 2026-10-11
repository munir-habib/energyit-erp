-- ============================================================================
-- EnergyIT — enable Realtime change broadcasts on the catalog tables so the
-- pricing grid (and any other admin edit) reaches every open session
-- instantly. Same read-all RLS as before still gates who receives the
-- broadcast — no new exposure.
-- ============================================================================

alter publication supabase_realtime add table
  public.products,
  public.pricing_formulas,
  public.product_energy_prices,
  public.tar_energia_btn,
  public.tar_potencia_btn,
  public.tar_energia_bte_mt,
  public.tar_potencia_bte_mt,
  public.potencia_contratada_valores,
  public.market_indices,
  public.suppliers,
  public.commission_rules;
