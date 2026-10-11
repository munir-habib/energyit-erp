-- Edição manual da data de renovação de uma CPE. Substitui sempre o valor atual
-- (sem distinção entre valor importado do CSV e valor manual) e a cache
-- pontos_consumo.data_fim_contrato — que alimenta os alertas — passa a refletir
-- exatamente o valor introduzido de imediato. Corre com o RLS do chamador.
create or replace function public.definir_data_renovacao(
  p_ponto_consumo_id uuid,
  p_data_fim date
)
returns public.pontos_consumo
language plpgsql
set search_path = public
as $$
declare
  v_periodo_id uuid;
  v_ponto public.pontos_consumo;
begin
  -- período mais recente (mesma ordenação usada pelo trigger de sincronização)
  select id into v_periodo_id
  from public.periodos_contrato
  where ponto_consumo_id = p_ponto_consumo_id
  order by data_fim desc nulls first, criado_em desc
  limit 1;

  if v_periodo_id is not null then
    update public.periodos_contrato set data_fim = p_data_fim where id = v_periodo_id;
  else
    -- CPE sem nenhum período ainda — cria o primeiro a partir dos dados atuais.
    -- owner_id explícito (a partir da CPE) para a função não depender de auth.uid().
    insert into public.periodos_contrato
      (ponto_consumo_id, owner_id, data_inicio, data_fim, estado, potencia_contratada, consumo_anual)
    select p_ponto_consumo_id, owner_id, coalesce(data_ativacao, current_date), p_data_fim,
           estado, potencia_contratada, consumo_anual
    from public.pontos_consumo where id = p_ponto_consumo_id;
  end if;

  -- Garante que a cache reflete exatamente o valor introduzido, mesmo quando a CPE
  -- tem vários períodos e o mais recente por data_fim não é o que acabámos de editar.
  update public.pontos_consumo
  set data_fim_contrato = p_data_fim, updated_at = now()
  where id = p_ponto_consumo_id
  returning * into v_ponto;

  if v_ponto.id is null then
    raise exception 'Ponto de consumo % não encontrado', p_ponto_consumo_id;
  end if;

  return v_ponto;
end;
$$;
