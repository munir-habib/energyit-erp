# EnergyIT

ERP para consultoria energética (eletricidade — BTN e BTE&MT). Compara faturas de clientes com o catálogo de fornecedores, calcula poupança estimada e real, gera propostas em PDF e calcula comissões.

## Stack

- React + Vite + TypeScript
- Tailwind CSS v4 (tokens de marca em `src/index.css`)
- Supabase (auth, Postgres, Row Level Security)
- mathjs (avaliação seguro de fórmulas de pricing indexado)
- jsPDF + jsPDF-AutoTable (propostas em PDF)
- TanStack Query

## Modelo de permissões

1. **Dados de negócio** (clientes, faturas, simulações, contratos, comissões) — isolados por conta via `owner_id = auth.uid()`. Sem exceção para o Admin.
2. **Catálogo de produtos e motor de cálculo** (produtos, fórmulas, TAR, potência contratada, regras de comissão, índices de mercado) — globais, leitura para qualquer utilizador autenticado, escrita só para `role = 'admin'`.

## Configuração

1. Cria um projeto em [supabase.com](https://supabase.com).
2. Copia `.env.example` para `.env` e preenche `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
3. Aplica as migrações em `supabase/migrations/` (SQL editor do Supabase, ou `supabase db push` com a CLI):
   - `0001_schema.sql` — tabelas, funções, triggers, RLS
   - `0002_seed.sql` — catálogo inicial de eletricidade (BTN + BTE&MT) com os valores de referência (GO = 10 €/MWh)
4. Para promover uma conta a Admin, atualiza manualmente na tabela `profiles`:
   ```sql
   update public.profiles set role = 'admin' where email = 'seu-email@exemplo.com';
   ```
5. Para login com Google, ativa o provider OAuth "Google" nas definições de Auth do Supabase e configura o redirect URL da app.

## Desenvolvimento

```bash
npm install
npm run dev
```

## Notas

- Gás está fora de âmbito nesta fase — o seletor de segmento mostra a opção desativada.
- O GO de referência usado nos dados de seed é 10 €/MWh — é um campo editável pelo Admin em Produtos, não um valor fixo no código.
- A comissão de cada produto fechado (X, Z, ZC, Deluxe, Deluxe+) fica por definir no seed — o Admin preenche em Produtos.
