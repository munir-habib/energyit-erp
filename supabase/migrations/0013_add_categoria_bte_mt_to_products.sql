-- BUG: compararProdutos (src/lib/pricingEngine.ts) só filtrava produtos por segmento ('BTE_MT'),
-- nunca por categoria (BTE vs MT) — a coluna nem existia. Resultado: produtos MT apareciam nas
-- comparações de BTE e vice-versa. Adiciona a coluna e faz o backfill a partir do nome (todos os
-- produtos BTE_MT existentes já têm "BTE" ou "MT" inequivocamente no nome).

alter table products
  add column if not exists categoria_bte_mt text check (categoria_bte_mt = any (array['BTE','MT']));

update products
set categoria_bte_mt = case
  when nome ilike '%BTE%' then 'BTE'
  when nome ilike '%MT%' then 'MT'
  else null
end
where segmento = 'BTE_MT';
