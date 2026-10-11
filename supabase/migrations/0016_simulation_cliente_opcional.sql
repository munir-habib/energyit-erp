-- Uma simulação pode agora começar "à solta", sem cliente selecionado (ver pedido: "Não obriga a
-- selecionar cliente"). O cliente só passa a ser obrigatório no momento de fechar contrato — nesse
-- ponto a interface pede para associar/criar um.
alter table public.simulations alter column client_id drop not null;
