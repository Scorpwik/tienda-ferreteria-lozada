import { supabase } from '@/lib/supabase'
import {
  aggregateAvailability,
  canAddToCart,
  pickPrimaryImage,
  priceRange,
  toVariant,
} from '@/lib/domain'
import {
  buildProductSearchDoc,
  rankSearchHit,
  searchAllTokensMatch,
  searchTokens,
} from '@/lib/productSearch'
import type {
  Availability,
  Paginated,
  ProductCard,
  ProductDetail,
  ProductImage,
} from '@/lib/domain'

export const PAGE_SIZE = 24

/**
 * Columnas de la tarjeta. Se piden las variantes solo con lo necesario para
 * calcular "Desde $X" y la disponibilidad; nunca se traen las ~2.900 filas.
 */
const CARD_SELECT = `
  id,
  origin_id,
  name,
  is_offer,
  is_bestseller,
  category:categories!products_category_id_fkey ( id, name, slug ),
  product_variants ( id, price, availability, size, color, presentation, sale_unit ),
  product_images ( id, url, is_primary, sort_order, variant_id )
` as const

type CardRow = {
  id: string
  origin_id: number | null
  name: string
  description?: string | null
  search_tags?: string[] | null
  is_offer: boolean
  is_bestseller: boolean
  category: { id: string; name: string; slug: string } | null
  product_variants: {
    id: string
    price: number
    availability: string
    size: string | null
    color: string | null
    presentation: string | null
    sale_unit: string | null
    barcode?: string | null
    origin_id?: number | null
  }[]
  product_images: {
    id: string
    url: string
    is_primary: boolean
    sort_order: number
    variant_id: string | null
  }[]
}

const SEARCH_SELECT = `
  id,
  origin_id,
  name,
  description,
  search_tags,
  is_offer,
  is_bestseller,
  category:categories!products_category_id_fkey ( id, name, slug ),
  product_variants ( id, price, availability, size, color, presentation, sale_unit, barcode, origin_id )
` as const

function variantCardLabel(variant: CardRow['product_variants'][number]): string {
  const parts = [variant.size, variant.color, variant.presentation].filter(
    (part): part is string => Boolean(part && part.trim()),
  )
  if (parts.length > 0) return parts.join(' / ')
  if (variant.sale_unit?.trim()) return variant.sale_unit.trim()
  return 'opción'
}

function toCard(row: CardRow): ProductCard {
  const variants = row.product_variants.map((variant) => ({
    id: variant.id,
    price: Number(variant.price ?? 0),
    availability: normalizeAvailability(variant.availability),
    label: variantCardLabel(variant),
    sale_unit: variant.sale_unit,
  }))
  const { from, to } = priceRange(variants)
  const images: ProductImage[] = row.product_images.map((image) => ({
    id: image.id,
    url: image.url,
    is_primary: image.is_primary,
    sort_order: image.sort_order,
    variant_id: image.variant_id,
  }))

  const sole = variants.length === 1 ? variants[0] : null
  const quickAdd =
    sole && canAddToCart(sole)
      ? {
          variantId: sole.id,
          unitPrice: sole.price,
          saleUnit: sole.sale_unit,
          variantLabel: sole.label && sole.label !== 'opción' ? sole.label : null,
        }
      : null

  return {
    id: row.id,
    origin_id: row.origin_id,
    name: row.name,
    categoryName: row.category?.name ?? null,
    categorySlug: row.category?.slug ?? null,
    imageUrl: pickPrimaryImage(images),
    priceFrom: from,
    priceTo: to,
    availability: aggregateAvailability(variants),
    variants: variants.map(({ label, availability }) => ({
      label,
      availability,
    })),
    variantCount: row.product_variants.length,
    quickAdd,
    isOffer: row.is_offer,
    isBestseller: row.is_bestseller,
  }
}

function normalizeAvailability(value: string): Availability {
  return value === 'disponible' || value === 'agotado' || value === 'consultar'
    ? value
    : 'consultar'
}

export type CatalogQuery = {
  search?: string
  categoryIds?: string[] | null
  availability?: Availability | null
  onlyOffers?: boolean
  onlyBestsellers?: boolean
  priceMin?: number | null
  priceMax?: number | null
  page?: number
  pageSize?: number
}

/** Techo del slider de precio: maximo real entre variantes con precio. */
export async function fetchCatalogPriceCeiling(): Promise<number> {
  const { data, error } = await supabase
    .from('product_variants')
    .select('price')
    .neq('availability', 'consultar')
    .gt('price', 0)
    .order('price', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  const max = Number(data?.price ?? 0)
  return Number.isFinite(max) && max > 0 ? Math.ceil(max) : 100
}

function escapeIlike(token: string): string {
  return token.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

function intersectIds(sets: Set<string>[]): Set<string> {
  if (sets.length === 0) return new Set()
  const [first, ...rest] = sets
  const result = new Set<string>()
  for (const id of first) {
    if (rest.every((set) => set.has(id))) result.add(id)
  }
  return result
}

/**
 * Cada token puede caer en nombre, tags, categoria, medida, color, etc.
 * Se piden candidatos por token y luego se exige que todos coincidan.
 */
async function fetchIdsForToken(token: string): Promise<Set<string>> {
  const pattern = `%${escapeIlike(token)}%`
  const numeric = /^[0-9./-]+$/.test(token) || token.length <= 2
  const ids = new Set<string>()

  if (numeric) {
    const variantFilters = [`size.ilike.${pattern}`, `barcode.ilike.${pattern}`]
    if (/^\d{1,18}$/.test(token)) variantFilters.push(`origin_id.eq.${token}`)

    const variants = await supabase
      .from('product_variants')
      .select('product_id, size, barcode, origin_id')
      .or(variantFilters.join(','))
      .limit(1000)

    if (variants.error) throw variants.error
    for (const row of variants.data ?? []) {
      const doc = buildProductSearchDoc({
        name: '',
        variants: [
          {
            size: row.size,
            barcode: row.barcode,
            originId: row.origin_id,
          },
        ],
      })
      if (searchAllTokensMatch(doc, [token])) ids.add(row.product_id)
    }

    if (/^\d{1,18}$/.test(token)) {
      const products = await supabase
        .from('products')
        .select('id')
        .eq('origin_id', Number(token))
        .limit(20)
      if (products.error) throw products.error
      for (const row of products.data ?? []) ids.add(row.id)
    }

    return ids
  }

  const productFilters = [
    `name.ilike.${pattern}`,
    `description.ilike.${pattern}`,
  ]
  if (/^[a-z0-9]+$/.test(token)) {
    productFilters.push(`search_tags.cs.{${token}}`)
  }

  const variantFilters = [
    `size.ilike.${pattern}`,
    `color.ilike.${pattern}`,
    `presentation.ilike.${pattern}`,
    `sale_unit.ilike.${pattern}`,
    `barcode.ilike.${pattern}`,
  ]

  const [products, variants] = await Promise.all([
    supabase.from('products').select('id').or(productFilters.join(',')).limit(1000),
    supabase
      .from('product_variants')
      .select('product_id')
      .or(variantFilters.join(','))
      .limit(1000),
  ])

  if (products.error) throw products.error
  if (variants.error) throw variants.error

  for (const row of products.data ?? []) ids.add(row.id)
  for (const row of variants.data ?? []) ids.add(row.product_id)
  return ids
}

function rowMatchesFilters(
  row: CardRow,
  query: CatalogQuery,
  tokens: string[],
): boolean {
  if (query.onlyOffers && !row.is_offer) return false
  if (query.onlyBestsellers && !row.is_bestseller) return false
  if (query.categoryIds?.length && !row.category?.id) return false
  if (
    query.categoryIds?.length &&
    row.category &&
    !query.categoryIds.includes(row.category.id)
  ) {
    return false
  }

  const doc = buildProductSearchDoc({
    name: row.name,
    description: row.description,
    searchTags: row.search_tags,
    originId: row.origin_id,
    categoryName: row.category?.name,
    variants: row.product_variants.map((variant) => ({
      size: variant.size,
      color: variant.color,
      presentation: variant.presentation,
      saleUnit: variant.sale_unit,
      barcode: variant.barcode,
      originId: variant.origin_id ?? null,
    })),
  })
  if (!searchAllTokensMatch(doc, tokens)) return false

  if (query.availability) {
    const hasAvailability = row.product_variants.some(
      (variant) => normalizeAvailability(variant.availability) === query.availability,
    )
    if (!hasAvailability) return false
  }

  const priceMin = query.priceMin
  const priceMax = query.priceMax
  if (priceMin != null || priceMax != null) {
    const inRange = row.product_variants.some((variant) => {
      if (normalizeAvailability(variant.availability) === 'consultar') return false
      const price = Number(variant.price ?? 0)
      if (price <= 0) return false
      if (priceMin != null && price < priceMin) return false
      if (priceMax != null && price > priceMax) return false
      return true
    })
    if (!inRange) return false
  }

  return true
}

async function fetchSmartCatalogPage(
  query: CatalogQuery,
  tokens: string[],
  page: number,
  pageSize: number,
): Promise<Paginated<ProductCard>> {
  const tokenSets = await Promise.all(tokens.map((token) => fetchIdsForToken(token)))
  let ids = [...intersectIds(tokenSets)]

  if (ids.length === 0) {
    return { items: [], total: 0, page, pageSize, totalPages: 0 }
  }

  if (query.categoryIds?.length) {
    const { data, error } = await supabase
      .from('products')
      .select('id')
      .in('id', ids)
      .in('category_id', query.categoryIds)
    if (error) throw error
    ids = (data ?? []).map((row) => row.id)
    if (ids.length === 0) {
      return { items: [], total: 0, page, pageSize, totalPages: 0 }
    }
  }

  const { data, error } = await supabase
    .from('products')
    .select(SEARCH_SELECT)
    .in('id', ids)

  if (error) throw error

  const matched = (data as unknown as CardRow[])
    .filter((row) => rowMatchesFilters(row, query, tokens))
    .sort((left, right) => {
      const rank = rankSearchHit(left.name, tokens) - rankSearchHit(right.name, tokens)
      if (rank !== 0) return rank
      if (left.is_bestseller !== right.is_bestseller) {
        return Number(right.is_bestseller) - Number(left.is_bestseller)
      }
      return left.name.localeCompare(right.name, 'es')
    })

  const total = matched.length
  const offset = (page - 1) * pageSize
  const pageRows = matched.slice(offset, offset + pageSize)
  if (pageRows.length === 0) {
    return { items: [], total, page, pageSize, totalPages: 0 }
  }

  const { data: cards, error: cardError } = await supabase
    .from('products')
    .select(CARD_SELECT)
    .in('id', pageRows.map((row) => row.id))

  if (cardError) throw cardError

  const byId = new Map((cards as unknown as CardRow[]).map((row) => [row.id, row]))
  const items = pageRows
    .map((row) => byId.get(row.id))
    .filter((row): row is CardRow => Boolean(row))
    .map(toCard)

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  }
}

/**
 * Catalogo paginado. Sin texto usa search_product_ids; con texto combina
 * nombre, medida, color y el resto de campos palabra por palabra.
 */
export async function fetchCatalogPage(
  query: CatalogQuery,
): Promise<Paginated<ProductCard>> {
  const pageSize = query.pageSize ?? PAGE_SIZE
  const page = Math.max(1, query.page ?? 1)
  const offset = (page - 1) * pageSize
  const tokens = query.search?.trim() ? searchTokens(query.search) : []

  if (tokens.length > 0) {
    return fetchSmartCatalogPage(query, tokens, page, pageSize)
  }

  const { data: matches, error: matchError } = await supabase.rpc(
    'search_product_ids',
    {
      p_query: undefined,
      p_category_ids: query.categoryIds?.length ? query.categoryIds : undefined,
      p_availability: query.availability ?? undefined,
      p_only_offers: query.onlyOffers ?? false,
      p_only_bestsellers: query.onlyBestsellers ?? false,
      p_price_min:
        query.priceMin != null && Number.isFinite(query.priceMin)
          ? query.priceMin
          : undefined,
      p_price_max:
        query.priceMax != null && Number.isFinite(query.priceMax)
          ? query.priceMax
          : undefined,
      p_limit: pageSize,
      p_offset: offset,
    },
  )

  if (matchError) throw matchError

  const rows = matches ?? []
  const total = rows.length > 0 ? Number(rows[0].total) : 0
  const ids = rows.map((row) => row.product_id)

  if (ids.length === 0) {
    return { items: [], total, page, pageSize, totalPages: 0 }
  }

  const { data, error } = await supabase
    .from('products')
    .select(CARD_SELECT)
    .in('id', ids)

  if (error) throw error

  // PostgREST no garantiza el orden de .in(), asi que se restaura el de la
  // funcion de busqueda, que es el orden por relevancia.
  const byId = new Map((data as unknown as CardRow[]).map((row) => [row.id, row]))
  const items = ids
    .map((id) => byId.get(id))
    .filter((row): row is CardRow => Boolean(row))
    .map(toCard)

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  }
}

/** Sugerencias del buscador. Tope bajo para no pesar en celulares lentos. */
export async function fetchSearchSuggestions(
  term: string,
): Promise<ProductCard[]> {
  const search = term.trim()
  if (search.length < 2) return []

  const page = await fetchCatalogPage({
    search,
    page: 1,
    pageSize: 6,
  })
  return page.items
}

/** Secciones del Home: se alimentan de los flags, nunca de una lista fija. */
export async function fetchHighlighted(
  kind: 'offer' | 'bestseller',
  limit = 12,
): Promise<ProductCard[]> {
  const { data, error } = await supabase
    .from('products')
    .select(CARD_SELECT)
    .eq(kind === 'offer' ? 'is_offer' : 'is_bestseller', true)
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data as unknown as CardRow[]).map(toCard)
}

/** Cinta del Home: productos con imagen para que la animacion no se vea vacia. */
export async function fetchMarqueeProducts(limit = 16): Promise<ProductCard[]> {
  const { data, error } = await supabase
    .from('products')
    .select(CARD_SELECT)
    .order('is_bestseller', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data as unknown as CardRow[]).map(toCard)
}

/** Sugerencias del carrito: mezcla de ofertas y mas vendidos.
 * Solo familias (padres) que no estén completamente agotadas. */
export async function fetchCartSuggestions(limit = 16): Promise<ProductCard[]> {
  // Pedimos de más por si al filtrar agotados nos quedamos cortos.
  const { data, error } = await supabase
    .from('products')
    .select(CARD_SELECT)
    .or('is_bestseller.eq.true,is_offer.eq.true')
    .order('is_bestseller', { ascending: false })
    .order('is_offer', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(Math.min(limit * 2, 48))

  if (error) throw error
  return (data as unknown as CardRow[])
    .map(toCard)
    .filter((product) => product.availability !== 'agotado')
    .slice(0, limit)
}

const DETAIL_SELECT = `
  id,
  origin_id,
  name,
  description,
  meta_title,
  meta_description,
  is_offer,
  is_bestseller,
  category:categories!products_category_id_fkey (
    id, name, slug, parent_id
  ),
  product_variants (
    id, origin_id, size, color, presentation, sale_unit,
    price, barcode, availability
  ),
  product_images ( id, url, is_primary, sort_order, variant_id )
` as const

type DetailRow = {
  id: string
  origin_id: number | null
  name: string
  description: string | null
  meta_title: string | null
  meta_description: string | null
  is_offer: boolean
  is_bestseller: boolean
  category: {
    id: string
    name: string
    slug: string
    parent_id: string | null
  } | null
  product_variants: {
    id: string
    origin_id: number | null
    size: string | null
    color: string | null
    presentation: string | null
    sale_unit: string | null
    price: number
    barcode: string | null
    availability: string
  }[]
  product_images: {
    id: string
    url: string
    is_primary: boolean
    sort_order: number
    variant_id: string | null
  }[]
}

/** La ficha se busca por origin_id, que es el codigo del sistema de facturacion. */
export async function fetchProductByOriginId(
  originId: number,
): Promise<ProductDetail | null> {
  const { data, error } = await supabase
    .from('products')
    .select(DETAIL_SELECT)
    .eq('origin_id', originId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return hydrateDetail(data as unknown as DetailRow)
}

export async function fetchProductById(
  id: string,
): Promise<ProductDetail | null> {
  const { data, error } = await supabase
    .from('products')
    .select(DETAIL_SELECT)
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return hydrateDetail(data as unknown as DetailRow)
}

async function hydrateDetail(row: DetailRow): Promise<ProductDetail> {
  let parentCategory: ProductDetail['parentCategory'] = null

  if (row.category?.parent_id) {
    const { data } = await supabase
      .from('categories')
      .select('id, name, slug')
      .eq('id', row.category.parent_id)
      .maybeSingle()
    parentCategory = data ?? null
  }

  const variants = row.product_variants
    .map(toVariant)
    .sort((a, b) =>
      (a.size ?? '').localeCompare(b.size ?? '', 'es', { numeric: true }),
    )

  return {
    id: row.id,
    origin_id: row.origin_id,
    name: row.name,
    description: row.description,
    metaTitle: row.meta_title,
    metaDescription: row.meta_description,
    isOffer: row.is_offer,
    isBestseller: row.is_bestseller,
    category: row.category
      ? { id: row.category.id, name: row.category.name, slug: row.category.slug }
      : null,
    parentCategory,
    variants,
    images: row.product_images.map((image) => ({
      id: image.id,
      url: image.url,
      is_primary: image.is_primary,
      sort_order: image.sort_order,
      variant_id: image.variant_id,
    })),
  }
}
