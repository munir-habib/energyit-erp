import { evaluate } from 'mathjs'
import type { MarketIndex, Product, PricingFormula } from '@/types/database'

export interface GoCellResult {
  value: number
  error?: string
  formula?: string
}

export type GoGrid = Map<string, GoCellResult>

export function slugify(nome: string): string {
  const clean = nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return /^[0-9]/.test(clean) ? `_${clean}` : clean || 'produto'
}

export function buildProductSlugs(products: Product[]): Map<string, string> {
  const used = new Map<string, number>()
  const slugs = new Map<string, string>()
  for (const p of products) {
    const base = slugify(p.nome)
    const count = used.get(base) ?? 0
    used.set(base, count + 1)
    slugs.set(p.id, count === 0 ? base : `${base}_${count}`)
  }
  return slugs
}

export function indiceScopeFromCatalog(marketIndices: MarketIndex[]): Record<string, number> {
  const scope: Record<string, number> = {}
  for (const idx of marketIndices) scope[`Indice_${slugify(idx.nome)}`] = idx.valor
  return scope
}

export function goScopeFromGrid(products: Product[], grid: GoGrid): Record<string, number> {
  const slugs = buildProductSlugs(products)
  const scope: Record<string, number> = {}
  for (const [id, slug] of slugs) scope[`GO_${slug}`] = grid.get(id)?.value ?? 0
  return scope
}

const GO_REF_RE = /\bGO_([A-Za-z0-9_]+)\b/g

/**
 * Avalia as fórmulas de GO da grelha (pricing_formulas.tipo = 'GO'), permitindo
 * que uma referencie o GO de outro produto pelo nome `GO_<slug-do-produto>`.
 * Resolve por ordem de dependências (Kahn); uma referência circular isola só
 * as células afetadas em vez de rebentar a grelha toda.
 */
export function buildGoGrid(
  products: Product[],
  goFormulas: PricingFormula[],
  marketIndices: MarketIndex[],
  potenciaPreviewKva = 20.7,
): GoGrid {
  const slugs = buildProductSlugs(products)
  const slugToProductId = new Map(Array.from(slugs, ([id, slug]) => [slug, id]))
  const formulaByProduct = new Map(goFormulas.map((f) => [f.product_id, f]))
  const indiceScope = indiceScopeFromCatalog(marketIndices)

  const result: GoGrid = new Map()
  const dependsOn = new Map<string, string[]>()

  for (const p of products) {
    const formula = formulaByProduct.get(p.id)
    if (!formula) {
      result.set(p.id, { value: p.go_valor ?? 0 })
      continue
    }
    const deps = new Set<string>()
    for (const match of formula.formula.matchAll(GO_REF_RE)) {
      const depProductId = slugToProductId.get(match[1])
      if (depProductId && depProductId !== p.id) deps.add(depProductId)
    }
    dependsOn.set(p.id, [...deps])
  }

  const pending = new Set(dependsOn.keys())
  const resolvedGoScope: Record<string, number> = {}
  for (const [id, r] of result) resolvedGoScope[`GO_${slugs.get(id)}`] = r.value

  let progressed = true
  while (pending.size > 0 && progressed) {
    progressed = false
    for (const productId of [...pending]) {
      const deps = dependsOn.get(productId) ?? []
      if (deps.some((d) => pending.has(d))) continue

      const product = products.find((p) => p.id === productId)!
      const formula = formulaByProduct.get(productId)!
      const depWithError = deps.find((d) => result.get(d)?.error)

      if (depWithError) {
        result.set(productId, { value: product.go_valor ?? 0, error: 'Depende de uma célula com erro', formula: formula.formula })
      } else {
        try {
          const value = evaluate(formula.formula, {
            ...indiceScope,
            ...resolvedGoScope,
            Margem: product.margem ?? 0,
            PotenciaContratada: potenciaPreviewKva,
          })
          if (typeof value !== 'number' || Number.isNaN(value)) throw new Error('não numérico')
          result.set(productId, { value, formula: formula.formula })
        } catch {
          result.set(productId, { value: product.go_valor ?? 0, error: 'Fórmula inválida', formula: formula.formula })
        }
      }
      resolvedGoScope[`GO_${slugs.get(productId)}`] = result.get(productId)!.value
      pending.delete(productId)
      progressed = true
    }
  }

  for (const productId of pending) {
    const product = products.find((p) => p.id === productId)!
    const formula = formulaByProduct.get(productId)!
    result.set(productId, { value: product.go_valor ?? 0, error: 'Referência circular', formula: formula.formula })
  }

  return result
}
