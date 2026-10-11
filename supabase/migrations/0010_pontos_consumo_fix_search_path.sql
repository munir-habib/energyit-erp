-- ============================================================================
-- Fix: renovar_ponto_consumo tinha search_path mutável (aviso de segurança
-- do linter Supabase). Fixa search_path = public, sem alterar comportamento.
-- ============================================================================

create or replace function public.renovar_ponto_consumo(
  p_ponto_consumo_id uuid,
  p_nova_data_fim date,
  p_estado text default null,
  p_potencia_contratada numeric default null,
  p_consumo_anual numeric default null
)
returns public.periodos_contrato
language plpgsql
set search_path = public
as $$
declare
  v_atual public.periodos_contrato;
  v_novo public.periodos_contrato;
begin
  select * into v_atual
    from public.periodos_contrato
    where ponto_consumo_id = p_ponto_consumo_id
    order by data_fim desc nulls first, criado_em desc
    limit 1;

  if v_atual.id is null then
    raise exception 'Ponto de consumo % não tem nenhum período de contrato registado', p_ponto_consumo_id;
  end if;

  if v_atual.data_fim is null then
    raise exception 'O período atual não tem data_fim definida — não é possível encadear uma renovação';
  end if;

  insert into public.periodos_contrato (
    ponto_consumo_id, owner_id, data_inicio, data_fim, estado, potencia_contratada, consumo_anual
  ) values (
    p_ponto_consumo_id,
    auth.uid(),
    v_atual.data_fim,
    p_nova_data_fim,
    coalesce(p_estado, v_atual.estado),
    coalesce(p_potencia_contratada, v_atual.potencia_contratada),
    coalesce(p_consumo_anual, v_atual.consumo_anual)
  )
  returning * into v_novo;

  return v_novo;
end;
$$;
