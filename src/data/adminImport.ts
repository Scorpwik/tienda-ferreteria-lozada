import { supabase } from '@/lib/supabase'
import { slugify } from '@/lib/format'
import { cleanSingleLine } from '@/lib/sanitize'
import {
  catalogImportSchema,
  type CatalogImport,
  type ImportProduct,
  type ImportVariant,
} from '@/lib/validation'
import { readableDbError } from '@/data/admin'

/**
 * Importacion del JSON del normalizador (Streamlit).
 * Orden fijo por FKs: categorias → productos → variantes.
 * Llaves: categories.slug, products.origin_id, product_variants.origin_id.
 * Nunca se usa barcode como llave (puede repetirse en el Excel).
 */

const BATCH = 80
const MAX_WARNINGS = 40

export type ImportSummary = {
  categoriesCreated: number
  categoriesUpdated: number
  productsCreated: number
  productsUpdated: number
  variantsCreated: number
  variantsUpdated: number
  warnings: string[]
}

export class ImportError extends Error {
  readonly details: string[]

  constructor(message: string, details: string[] = []) {
    super(message)
    this.name = 'ImportError'
    this.details = details
  }
}

function pushWarning(warnings: string[], message: string): void {
  if (warnings.length < MAX_WARNINGS) warnings.push(message)
}

function uniqueSlug(base: string, used: Set<string>): string {
  const root = slugify(base) || 'categoria'
  if (!used.has(root)) {
    used.add(root)
    return root
  }
  let index = 2
  while (used.has(`${root}-${index}`)) index += 1
  const slug = `${root}-${index}`
  used.add(slug)
  return slug
}

function emptyText(value: string | null | undefined): string | null {
  if (value == null) return null
  const cleaned = cleanSingleLine(value, 80)
  return cleaned.length > 0 ? cleaned : null
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size))
  }
  return out
}

/**
 * Parsea el texto crudo (textarea o archivo) y valida con Zod.
 * Devuelve el payload listo para upsert, o un ImportError legible.
 */
export function parseCatalogImport(raw: string): CatalogImport {
  const trimmed = raw.trim()
  if (!trimmed) {
    throw new ImportError('Pega o sube el JSON del normalizador.')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    throw new ImportError(
      'El archivo no es un JSON válido. Revisa comas, comillas y corchetes.',
    )
  }

  // Algunos exports envuelven el catalogo en { catalog: { ... } }.
  const candidate =
    parsed &&
    typeof parsed === 'object' &&
    !Array.isArray(parsed) &&
    'catalog' in parsed
      ? (parsed as { catalog: unknown }).catalog
      : parsed

  const result = catalogImportSchema.safeParse(candidate)
  if (!result.success) {
    throw new ImportError(
      'El JSON no tiene la forma esperada.',
      result.error.issues.slice(0, 8).map((issue) => {
        const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : ''
        return `${path}${issue.message}`
      }),
    )
  }

  if (
    result.data.categories.length === 0 &&
    result.data.products.length === 0
  ) {
    throw new ImportError('El JSON no trae categorías ni productos.')
  }

  return result.data
}

async function upsertCategories(
  catalog: CatalogImport,
  warnings: string[],
): Promise<{
  idMap: Map<string, string>
  created: number
  updated: number
}> {
  const { data: existing, error } = await supabase
    .from('categories')
    .select('id, slug, name, parent_id, sort_order')
  if (error) throw new Error(readableDbError(error))

  const bySlug = new Map((existing ?? []).map((row) => [row.slug, row]))
  const usedSlugs = new Set(bySlug.keys())
  const idMap = new Map<string, string>()

  // Padres primero: parent_id apunta a otro id temporal del mismo JSON.
  const byImportId = new Map(catalog.categories.map((row) => [row.id, row]))
  const ordered: typeof catalog.categories = []
  const visiting = new Set<string>()
  const placed = new Set<string>()

  const place = (id: string) => {
    if (placed.has(id)) return
    if (visiting.has(id)) {
      pushWarning(
        warnings,
        `Hay un ciclo entre categorías (incluye "${id}"); se cortó la relación madre.`,
      )
      return
    }
    const row = byImportId.get(id)
    if (!row) return
    visiting.add(id)
    if (row.parent_id && byImportId.has(row.parent_id)) {
      place(row.parent_id)
    } else if (row.parent_id && !byImportId.has(row.parent_id)) {
      pushWarning(
        warnings,
        `Categoría "${row.name}" tiene una categoría madre desconocida; se importó sin madre.`,
      )
      row.parent_id = null
    }
    visiting.delete(id)
    placed.add(id)
    ordered.push(row)
  }

  for (const row of catalog.categories) place(row.id)

  let created = 0
  let updated = 0

  for (const row of ordered) {
    const preferredSlug =
      row.slug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.slug)
        ? row.slug
        : slugify(row.name)
    const existingBySlug = bySlug.get(preferredSlug)
    // Si el slug ya existe, reutilizamos esa fila; si no, buscamos uno libre.
    const slug = existingBySlug ? preferredSlug : uniqueSlug(preferredSlug, usedSlugs)

    const parentUuid = row.parent_id ? (idMap.get(row.parent_id) ?? null) : null
    const payload = {
      name: row.name,
      slug,
      parent_id: parentUuid,
      sort_order: row.sort_order ?? 0,
    }

    if (existingBySlug) {
      const { data, error: updateError } = await supabase
        .from('categories')
        .update(payload)
        .eq('id', existingBySlug.id)
        .select('id')
        .single()
      if (updateError) throw new Error(readableDbError(updateError))
      idMap.set(row.id, data.id)
      updated += 1
    } else {
      const { data, error: insertError } = await supabase
        .from('categories')
        .insert(payload)
        .select('id')
        .single()
      if (insertError) throw new Error(readableDbError(insertError))
      idMap.set(row.id, data.id)
      bySlug.set(slug, {
        id: data.id,
        slug,
        name: row.name,
        parent_id: parentUuid,
        sort_order: payload.sort_order,
      })
      created += 1
    }
  }

  return { idMap, created, updated }
}

type ProductRow = { id: string; origin_id: number | null }

async function loadProductsByOrigin(
  originIds: number[],
): Promise<Map<number, string>> {
  const map = new Map<number, string>()
  for (const group of chunk(originIds, BATCH)) {
    const { data, error } = await supabase
      .from('products')
      .select('id, origin_id')
      .in('origin_id', group)
    if (error) throw new Error(readableDbError(error))
    for (const row of (data ?? []) as ProductRow[]) {
      if (row.origin_id != null) map.set(row.origin_id, row.id)
    }
  }
  return map
}

async function loadVariantsByOrigin(
  originIds: number[],
): Promise<Map<number, string>> {
  const map = new Map<number, string>()
  for (const group of chunk(originIds, BATCH)) {
    const { data, error } = await supabase
      .from('product_variants')
      .select('id, origin_id')
      .in('origin_id', group)
    if (error) throw new Error(readableDbError(error))
    for (const row of data ?? []) {
      if (row.origin_id != null) map.set(row.origin_id, row.id)
    }
  }
  return map
}

function variantPayload(
  productId: string,
  variant: ImportVariant,
): {
  product_id: string
  origin_id: number | null
  size: string | null
  color: string | null
  presentation: string | null
  sale_unit: string | null
  price: number
  barcode: string | null
  availability: 'disponible' | 'agotado' | 'consultar'
} {
  return {
    product_id: productId,
    origin_id: variant.origin_id ?? null,
    size: emptyText(variant.size),
    color: emptyText(variant.color),
    presentation: emptyText(variant.presentation),
    sale_unit: emptyText(variant.sale_unit),
    price: variant.price ?? 0,
    barcode: emptyText(variant.barcode),
    availability: variant.availability ?? 'consultar',
  }
}

async function upsertProducts(
  products: ImportProduct[],
  categoryIdMap: Map<string, string>,
  warnings: string[],
): Promise<{
  productIdByOrigin: Map<number, string>
  created: number
  updated: number
}> {
  const originIds = products.map((product) => product.origin_id)
  const existing = await loadProductsByOrigin(originIds)
  let created = 0
  let updated = 0

  type ProductPayload = {
    origin_id: number
    name: string
    description: string | null
    category_id: string | null
    slug?: string | null
    meta_title?: string | null
    meta_description?: string | null
    search_tags?: string[] | null
  }

  // Upsert en lotes: insert y update por separado para poder contar.
  const toInsert: ProductPayload[] = []
  const toUpdate: (ProductPayload & { id: string })[] = []

  for (const product of products) {
    let categoryUuid: string | null = null
    if (product.category_id) {
      categoryUuid = categoryIdMap.get(product.category_id) ?? null
      if (!categoryUuid) {
        // Puede ser un UUID real ya existente en la base.
        if (
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            product.category_id,
          )
        ) {
          categoryUuid = product.category_id
        } else {
          pushWarning(
            warnings,
            `Producto ${product.origin_id} ("${product.name}"): categoría "${product.category_id}" no encontrada; quedó sin categoría.`,
          )
        }
      }
    }

    const payload: ProductPayload = {
      origin_id: product.origin_id,
      name: product.name,
      description: product.description,
      category_id: categoryUuid,
    }
    // Solo pisa SEO si el JSON del normalizador trae la clave.
    if (product.slug !== undefined) payload.slug = product.slug
    if (product.meta_title !== undefined) payload.meta_title = product.meta_title
    if (product.meta_description !== undefined) {
      payload.meta_description = product.meta_description
    }
    if (product.search_tags !== undefined) {
      payload.search_tags = product.search_tags
    }

    const existingId = existing.get(product.origin_id)
    if (existingId) {
      toUpdate.push({ id: existingId, ...payload })
    } else {
      toInsert.push(payload)
    }
  }

  for (const group of chunk(toInsert, BATCH)) {
    const { data, error } = await supabase
      .from('products')
      .insert(group)
      .select('id, origin_id')
    if (error) throw new Error(readableDbError(error))
    for (const row of (data ?? []) as ProductRow[]) {
      if (row.origin_id != null) existing.set(row.origin_id, row.id)
    }
    created += data?.length ?? 0
  }

  for (const group of chunk(toUpdate, BATCH)) {
    // Supabase no hace update masivo con filas distintas: una a una en lote.
    await Promise.all(
      group.map(async (row) => {
        const { id, ...payload } = row
        const { error } = await supabase
          .from('products')
          .update(payload)
          .eq('id', id)
        if (error) throw new Error(readableDbError(error))
      }),
    )
    updated += group.length
  }

  return { productIdByOrigin: existing, created, updated }
}

async function upsertVariants(
  products: ImportProduct[],
  productIdByOrigin: Map<number, string>,
  warnings: string[],
): Promise<{ created: number; updated: number }> {
  type Pending = {
    productId: string
    variant: ImportVariant
    productOrigin: number
  }

  const withOrigin: Pending[] = []
  const withoutOrigin: Pending[] = []

  for (const product of products) {
    const productId = productIdByOrigin.get(product.origin_id)
    if (!productId) {
      pushWarning(
        warnings,
        `No se pudieron importar las variantes de ${product.origin_id}: el producto no quedó guardado.`,
      )
      continue
    }
    for (const variant of product.variants) {
      const pending = {
        productId,
        variant,
        productOrigin: product.origin_id,
      }
      if (variant.origin_id) withOrigin.push(pending)
      else withoutOrigin.push(pending)
    }
  }

  const originIds = withOrigin
    .map((item) => item.variant.origin_id)
    .filter((id): id is number => id != null)
  const existing = await loadVariantsByOrigin(originIds)

  let created = 0
  let updated = 0

  const toInsert = withOrigin
    .filter((item) => !existing.has(item.variant.origin_id as number))
    .map((item) => variantPayload(item.productId, item.variant))

  const toUpdate = withOrigin
    .filter((item) => existing.has(item.variant.origin_id as number))
    .map((item) => ({
      id: existing.get(item.variant.origin_id as number) as string,
      ...variantPayload(item.productId, item.variant),
    }))

  for (const group of chunk(toInsert, BATCH)) {
    const { data, error } = await supabase
      .from('product_variants')
      .insert(group)
      .select('id')
    if (error) throw new Error(readableDbError(error))
    created += data?.length ?? 0
  }

  for (const group of chunk(toUpdate, BATCH)) {
    await Promise.all(
      group.map(async (row) => {
        const { id, ...payload } = row
        const { error } = await supabase
          .from('product_variants')
          .update(payload)
          .eq('id', id)
        if (error) throw new Error(readableDbError(error))
      }),
    )
    updated += group.length
  }

  // Sin origin_id no hay llave estable: se insertan como nuevas y se avisa.
  for (const item of withoutOrigin) {
    pushWarning(
      warnings,
      `Producto ${item.productOrigin}: una variante sin origin_id se insertó como nueva (no se puede actualizar después).`,
    )
  }
  for (const group of chunk(withoutOrigin, BATCH)) {
    const payload = group.map((item) =>
      variantPayload(item.productId, item.variant),
    )
    const { data, error } = await supabase
      .from('product_variants')
      .insert(payload)
      .select('id')
    if (error) throw new Error(readableDbError(error))
    created += data?.length ?? 0
  }

  return { created, updated }
}

/**
 * Ejecuta la importacion completa. El llamador debe haber validado con
 * parseCatalogImport. Devuelve un resumen para mostrar en el panel.
 */
export async function importCatalog(
  catalog: CatalogImport,
): Promise<ImportSummary> {
  const warnings: string[] = []

  const categories = await upsertCategories(catalog, warnings)
  const products = await upsertProducts(
    catalog.products,
    categories.idMap,
    warnings,
  )
  const variants = await upsertVariants(
    catalog.products,
    products.productIdByOrigin,
    warnings,
  )

  if (warnings.length >= MAX_WARNINGS) {
    warnings.push('…hay más advertencias; revisa el JSON del normalizador.')
  }

  return {
    categoriesCreated: categories.created,
    categoriesUpdated: categories.updated,
    productsCreated: products.created,
    productsUpdated: products.updated,
    variantsCreated: variants.created,
    variantsUpdated: variants.updated,
    warnings,
  }
}
