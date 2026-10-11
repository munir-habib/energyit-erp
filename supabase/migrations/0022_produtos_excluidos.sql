-- Filtro de produtos/comercializadoras excluídos da comparação (3.8 do formulário de simulação) nunca
-- foi persistido — por isso "Duplicar simulação" (e o modo de edição em geral) não consegue restaurar
-- essa escolha, mesmo copiando/reabrindo todos os outros campos corretamente.
--
-- NOTA: o código já grava/restaura este campo (simulationForm.ts: dadosDaSimulacao /
-- estadoFormularioDaSimulacao; SimulationNewPage.tsx). Enquanto esta migração não for aplicada ao
-- projeto Supabase, useCreateSimulation/useUpdateSimulation detetam a coluna em falta (PGRST204) e
-- gravam sem ela — a simulação grava na mesma, só o filtro não fica persistido. Aplicar para ativar.
alter table public.simulations add column produtos_excluidos jsonb;
