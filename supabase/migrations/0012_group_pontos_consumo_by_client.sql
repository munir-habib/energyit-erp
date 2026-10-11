-- Corrige uma importação anterior de Pontos de Consumo (CPEs) que nunca chegou a criar
-- nem associar Clientes: os 114 pontos_consumo existentes tinham client_id nulo. Agrupa-os
-- por NIF (critério principal) — todos os registos já tinham NIF preenchido e o mapeamento
-- NIF <-> nome era 1:1 em todos os casos, sem ambiguidade — e cria um Cliente por NIF único,
-- associando-lhe todos os CPEs correspondentes.

do $$
declare
  v_owner_id uuid := '27ba5b21-5d6b-418e-b927-4ab7d9925031';
  v_client_id uuid;
  r record;
begin
  for r in
    select cliente, nif
    from pontos_consumo
    group by cliente, nif
  loop
    insert into clients (owner_id, nome, nif, segmento_principal)
    values (v_owner_id, r.cliente, r.nif, 'BTN')
    returning id into v_client_id;

    update pontos_consumo
    set client_id = v_client_id
    where cliente = r.cliente and nif = r.nif;
  end loop;
end $$;
