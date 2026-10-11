-- Ficheiro da fatura lida automaticamente na simulação (InvoiceUploadCard) fica guardado junto da
-- simulação, como referência (ex: Poupança Real). Só alarga o check de entity_type — os ficheiros
-- continuam no mesmo bucket privado `documents`, com o mesmo isolamento por owner_id (caminho
-- {owner_id}/simulation/{simulation_id}/…), sem nenhuma alteração às políticas existentes.
alter table public.documents drop constraint documents_entity_type_check;
alter table public.documents
  add constraint documents_entity_type_check check (entity_type in ('client', 'contract', 'simulation'));
