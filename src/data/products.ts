import { supabase } from '@/lib/supabase'
import {
  aggregateAvailability,
  canAddToCart,
  pickPrimaryImage,
  priceRange,
  toVariant,
} from '@/lib/domain'
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
  }[]
  product_images: {
    id: string
    url: string
    is_primary: boolean
    sort_order: number
    variant_id: string | null
  }[]
}

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

/**
 * Catalogo paginado. La seleccion de ids ocurre en la funcion indexada
 * search_product_ids y aqui solo se hidratan los 24 de la pagina actual.
 */
export async function fetchCatalogPage(
  query: CatalogQuery,
): Promise<Paginated<ProductCard>> {
  const pageSize = query.pageSize ?? PAGE_SIZE
  const page = Math.max(1, query.page ?? 1)
  const offset = (page - 1) * pageSize

  const { data: matches, error: matchError } = await supabase.rpc(
    'search_product_ids',
    {
      p_query: query.search?.trim() ? query.search.trim() : undefined,
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
