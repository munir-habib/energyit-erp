# Redesenho do motor de simulação — linhas de comparação, GO por linha, candidata/escolhida

Documento de design técnico, sem código nem alterações à base de dados — preparado enquanto o
Supabase MCP está sem autorização nesta sessão. Cobre os 7 pontos do pedido. Serve de referência para
implementar assim que a ligação for reautorizada (secção 9 dá a ordem de execução).

## 1. Contexto e porque isto é mais simples do que parecia

A leitura inicial era que isto precisava de esquema novo na base de dados (colunas para GO/fixação/
candidata/escolhida por linha) — o mesmo bloqueio dos últimos 4 pedidos. **Não é o caso.**

`simulations.resultados` já é `jsonb` sem esquema imposto pela BD (`supabase/migrations/0001_schema.sql`).
Cada elemento desse array (`SimulationResultLine`, `src/types/database.ts`) já É, na prática, uma
"linha" — só falta:
1. Um produto poder gerar **várias** linhas (uma por variante de prazo/período), em vez de sempre uma só.
2. Cada linha guardar `go_override`, `go_fixado`, `candidata`, `escolhida` — campos novos **dentro**
   dos objetos do array, não colunas novas na tabela.

Ou seja: isto dá para implementar **sem qualquer migração de esquema**. O único pedaço que continua
bloqueado é o âmbito "Grupo inteiro" do ponto 5, que depende da entidade Grupo (ainda não existe,
precisa de tabela nova — ver o prompt anterior sobre Grupos).

## 2. `SimulationResultLine` — campos novos

```ts
export interface SimulationResultLine {
  // ... campos existentes (product_id, produto_nome, tipo, variant_id, variant_label,
  //     precos_periodo, custo_energia_periodo, poupanca_*, potencia_eur_dia, preco_medio_ponderado) ...

  /** GO desta linha (€/MWh) — independente de todas as outras linhas da simulação. null só em produtos Fechados. */
  go_override: number | null
  /** true = GO fixado nesta linha (botão "Fixar GO") — badge visível, motor deixa de recalcular ao arrastar o slider global (não existe slider global, é sempre por linha). */
  go_fixado: boolean
  /** Marcação "candidata" (⭐) — quantas quiser por CPE, entra no Documento Interno. */
  candidata: boolean
  /** Marcação "escolhida" (✓) — no máximo 1 true por simulação/CPE, é o que vai para o Documento do Cliente. */
  escolhida: boolean
}
```

`Simulation.produto_escolhido_id` e `Simulation.go_override`/`go_fixado` (colunas a nível da
simulação, esta última nem chegou a ser aplicada — `0023_go_fixado.sql` continua por aplicar) ficam
**obsoletos** — não é preciso removê-los da tabela, só deixar de os usar. `produto_escolhido_id`
mantém-se só como cache de leitura rápida (ver secção 4).

## 3. "Migração" — normalização à leitura, não um batch SQL

Em vez de um job SQL de uma vez só (que precisaria da BD real, coisa que não tenho agora), a
compatibilidade fica resolvida numa função pura:

```ts
/** Lê uma simulação tal como está gravada e devolve resultados já no formato de linhas novo —
 * simulações antigas (sem candidata/escolhida/go_override por linha) são normalizadas em memória,
 * nunca reescritas à força. Chamada sempre que uma simulação é carregada (useSimulation/useSimulations). */
function normalizarResultados(simulation: Simulation): SimulationResultLine[] {
  return simulation.resultados.map((l) => ({
    ...l,
    go_override: l.go_override ?? (l.tipo !== 'FECHADO' ? simulation.go_override : null),
    go_fixado: l.go_fixado ?? false,
    candidata: l.candidata ?? false,
    escolhida: l.escolhida ?? (l.product_id === simulation.produto_escolhido_id),
  }))
}
```

Isto cumpre o pedido 6 sem escrever nada na BD: o valor único antigo (`simulation.go_override`)
continua a servir de GO inicial para as linhas dessa simulação, e a linha do produto escolhido/fechado
antigo fica `escolhida: true` automaticamente — exatamente o comportamento pedido, só que resolvido em
runtime em vez de um UPDATE em massa.

**Sub-ponto a decidir contigo:** o pedido 6 pede para eu mostrar contagens ("quantas simulações foram
migradas, quantas linhas foram criadas") antes de aceitares como aplicado — isso é a linguagem de uma
migração em lote. A normalização à leitura não tem "toma" — funciona sempre, para qualquer simulação
antiga, sem precisar de correr nada. Se preferires mesmo um UPDATE em lote (para os dados ficarem
fisicamente no formato novo, por exemplo para relatórios feitos diretamente em SQL), isso continua a
precisar do Supabase e fica documentado como opcional na secção 9 — não bloqueia o resto.

## 4. Motor de preços (`pricingEngine.ts`) — mudanças

- **`compararProdutos` deixa de devolver 1 resultado por produto — passa a devolver 1 resultado por
  (produto, variante).** Para produtos sem variantes (Fechados simples), continua a ser 1 linha. Para
  produtos com variantes (EZU GO, SuperNova Flex/BOOST/MAX), gera 1 linha por variante do grupo ativo
  (`grupoAtivo`/`variantesDoProduto`, já existem — reaproveitados, não recriados).
- **GO deixa de ser um único `SimulationInput.goOverride` aplicado a tudo** — passa a ser resolvido
  por linha: `goInicialDaLinha = go_valor do produto (goValorResolvido/goGrid, já existe) `, e depois
  cada linha guarda o seu próprio valor ajustável, independente.
- `precificarProduto` (a função que calcula 1 linha) já recebe `variantId` e um `goResolvido` como
  parâmetros lógicos — só precisa de deixar de vir de um mapa único `variantePorProduto`/`goOverride`
  da simulação inteira, e passar a vir de cada linha pedida. A lógica de cálculo em si (TAR, GO/1000,
  poupança) **não muda nada** — só a forma como é invocada (por linha, não por produto).
- **Vista colapsada:** por omissão só se computa/mostra a linha "default" de cada produto (a variante
  mais recente/curta, mesma regra que `variantePadrao` já usa hoje). "Ver mais prazos/períodos" chama
  o motor para as restantes variantes desse produto só nesse momento (lazy) — evita computar N
  variantes de todos os produtos sempre, mantendo a tabela rápida por omissão, tal como pedido.

## 5. UI — Tabela de comparação (`ResultsTable.tsx`)

- Agrupar linhas por Comercializadora+Produto; mostrar só a linha default; botão "Ver mais
  prazos/períodos" por grupo expande as restantes variantes como linhas extra (reaproveita o padrão
  de expandir já existente para o detalhe por período).
- Cada linha com GO (tipo ≠ Fechado) ganha, na área expandida da própria linha, o `GoSlider` + campo
  + botão "Fixar GO" (já desenhados no prompt anterior, nunca ligados por falta de coluna — afinal não
  precisam de coluna nenhuma, só de viver dentro da linha). Ajustar o slider de uma linha só
  recalcula essa linha (chamada local ao motor), nunca a simulação inteira.
- 2 colunas de marcação por linha: ⭐ Candidata (toggle livre) e ✓ Escolhida (rádio — marcar uma
  desmarca a anterior da mesma simulação, feito em estado local, só 1 write ao gravar).
- Isto substitui o único `<GoSlider>` global da secção "3.7 GO" do formulário — deixa de fazer
  sentido um GO por simulação quando cada linha tem o seu.

## 6. Documentos (`pdf.ts`)

- **Documento Interno:** por CPE selecionada, filtra `resultados.filter(l => l.candidata)` (em vez de
  mostrar sempre todas as linhas). GO de cada uma sempre visível (`l.go_override`, já por linha —
  a condição deixa de precisar de olhar para `simulation.go_override`). CPE sem nenhuma candidata:
  aviso discreto em vez de omitir a secção — texto sugerido: *"Nenhuma opção marcada como candidata
  para esta CPE."*
- **Documento do Cliente:** por CPE selecionada, `resultados.find(l => l.escolhida)` — se `undefined`,
  **bloqueia a geração** (não gera com a de maior poupança nem com a sugerida). Mensagem sugerida:
  *"A CPE {código} não tem nenhuma linha marcada como Escolhida — marca uma antes de gerar o
  Documento do Cliente."* Isto substitui `linhaEscolhida()` (hoje lê `produto_escolhido_id`) por uma
  função equivalente sobre `l.escolhida`.

## 7. "Compor documento" — novo ecrã de âmbito

Um passo explícito antes de gerar (hoje a seleção já existe em `ClientDetailPage.tsx`, mas só ao
nível do Cliente — isto generaliza-a):
- **1 CPE** — já existe.
- **Várias CPEs da mesma Empresa, qualquer segmento** — já é o caso hoje (`ClientDetailPage` já deixa
  misturar CPEs de segmentos diferentes do mesmo cliente; só precisa de confirmar visualmente que
  cada uma fica na sua própria secção, nunca comparadas entre si — já é assim, os documentos já
  tratam cada CPE como uma secção independente).
- **Grupo inteiro (várias Empresas)** — **continua bloqueado**, precisa da entidade Grupo.

## 8. Risco — o que NÃO muda

- Cálculo de poupança, TAR, arredondamento: zero alterações (memória: nunca arredondar intermédios).
- Isolamento por CPE: cada linha continua presa à sua simulação/CPE, nada partilhado entre CPEs.
- `useCreateSimulation`/`useMarcarSimulacaoAtiva`/duplicar: a lógica de `ativa` (1 por CPE) não muda —
  isto mexe no conteúdo de `resultados`, não em como uma simulação fica ativa.

## 9. Ordem de implementação sugerida (quando avançar)

1. Tipo `SimulationResultLine` + `normalizarResultados` (sem tocar em mais nada — safe, só aditivo).
2. Motor: `compararProdutos` a devolver várias linhas por produto + GO por linha.
3. `ResultsTable.tsx`: agrupar/colapsar, "Ver mais", GO por linha, candidata/escolhida.
4. `SimulationNewPage.tsx`: remover o GO global da secção 3.7 (fica só por linha); gravar
   candidata/escolhida ao guardar.
5. `pdf.ts`: Documento Interno por candidatas, Documento do Cliente por escolhida + bloqueio.
6. `ClientDetailPage.tsx`: generalizar para "Compor documento" (CPE/Empresa já dá; Grupo fica a
   aguardar a entidade Grupo).
7. Testar exatamente o ponto 7 do pedido (CPE BTE, 2 candidatas com GOs diferentes, expandir
   variantes, marcar escolhida, bloqueio sem escolha, documento multi-CPE).
8. Opcional, só depois de tudo estável: migração SQL em lote para normalizar fisicamente as linhas
   antigas na BD (não bloqueia nada do resto, é só arrumação).

## 10. Pergunta em aberto

Descobri a meio deste design que, ao contrário do que pensava ao início da conversa, isto **não**
precisa de esperar pelo Supabase — só o âmbito "Grupo" (7 do pedido não testa Grupo, por acaso). Faz
sentido eu avançar já com a implementação (pontos 1-7 da secção 9), ou preferes que fique só o design
por agora?
