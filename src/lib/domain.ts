import type { Tables } from './types.database'

export type Availability = 'disponible' | 'agotado' | 'consultar'

export type VariantLike = {
  size: string | null
  color: string | null
  presentation: string | null
  sale_unit: string | null
}

export type Variant = {
  id: string
  origin_id: number | null
  size: string | null
  color: string | null
  presentation: string | null
  sale_unit: string | null
  price: number
  barcode: string | null
  availability: Availability
}

export type ProductImage = {
  id: string
  url: string
  is_primary: boolean
  sort_order: number
  variant_id: string | null
}

/** Combo temporal. No es un producto: no hay stock, variantes ni carrito. */
export type Promotion = {
  id: string
  title: string
  description: string | null
  priceLabel: string | null
  imageUrl: string
  startDate: string
  endDate: string
  createdAt: string
}

export type Category = {
  id: string
  name: string
  slug: string
  parent_id: string | null
  sort_order: number
}

export type CategoryNode = Category & { children: CategoryNode[] }

/** Variante reducida para badges de disponibilidad en el catalogo. */
export type CardVariantAvailability = {
  label: string
  availability: Availability
}

/** Datos para agregar desde la tarjeta cuando hay una sola variante vendible. */
export type ProductQuickAdd = {
  variantId: string
  unitPrice: number
  saleUnit: string | null
  variantLabel: string | null
}

/** Lo minimo que la tarjeta del catalogo necesita para pintarse. */
export type ProductCard = {
  id: string
  origin_id: number | null
  name: string
  categoryName: string | null
  categorySlug: string | null
  imageUrl: string | null
  priceFrom: number | null
  priceTo: number | null
  availability: Availability
  /** Detalle por variante para badges especificos ("Agotado: 6x2"). */
  variants: CardVariantAvailability[]
  variantCount: number
  /** Presente solo si hay exactamente 1 variante y se puede vender. */
  quickAdd: ProductQuickAdd | null
  isOffer: boolean
  isBestseller: boolean
}

export type ProductDetail = {
  id: string
  origin_id: number | null
  name: string
  description: string | null
  metaTitle: string | null
  metaDescription: string | null
  isOffer: boolean
  isBestseller: boolean
  category: Pick<Category, 'id' | 'name' | 'slug'> | null
  parentCategory: Pick<Category, 'id' | 'name' | 'slug'> | null
  variants: Variant[]
  images: ProductImage[]
}

export type Paginated<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/* ---------- Reglas de negocio puras ---------- */

/**
 * Disponibilidad de la familia a partir de sus variantes.
 * Basta una variante disponible para que el producto se pueda pedir.
 * Si no hay ninguna disponible pero si alguna a consultar, se consulta.
 */
export function aggregateAvailability(
  variants: Pick<Variant, 'availability'>[],
): Availability {
  if (variants.length === 0) return 'consultar'
  if (variants.some((v) => v.availability === 'disponible')) return 'disponible'
  if (variants.some((v) => v.availability === 'consultar')) return 'consultar'
  return 'agotado'
}

/**
 * Badge de la tarjeta: no se muestra si todo está disponible.
 * Si solo algunas variantes fallan, nombra esas medidas (nunca implica
 * que toda la familia está agotada).
 */
export function catalogAvailabilityBadge(
  variants: CardVariantAvailability[],
): { availability: Availability; label: string } | null {
  if (variants.length === 0) return null

  const all = (status: Availability) =>
    variants.every((variant) => variant.availability === status)

  if (all('disponible')) return null
  if (all('agotado')) return { availability: 'agotado', label: 'Agotado' }
  if (all('consultar')) {
    return { availability: 'consultar', label: 'Consultar precio' }
  }

  const labelsFor = (status: Availability) =>
    variants
      .filter((variant) => variant.availability === status)
      .map((variant) => variant.label)
      .filter(Boolean)

  const agotados = labelsFor('agotado')
  if (agotados.length > 0) {
    return {
      availability: 'agotado',
      label: `Agotado: ${agotados.join(', ')}`,
    }
  }

  const consultar = labelsFor('consultar')
  if (consultar.length > 0) {
    return {
      availability: 'consultar',
      label: `Consultar: ${consultar.join(', ')}`,
    }
  }

  return null
}

/**
 * Rango de precios visible. Solo cuentan las variantes que se pueden vender
 * con precio publicado: las de 'consultar' no tienen precio que mostrar.
 */
export function priceRange(variants: Pick<Variant, 'price' | 'availability'>[]): {
  from: number | null
  to: number | null
} {
  const prices = variants
    .filter((v) => v.availability !== 'consultar' && v.price > 0)
    .map((v) => v.price)

  if (prices.length === 0) return { from: null, to: null }
  return { from: Math.min(...prices), to: Math.max(...prices) }
}

/** Solo se puede añadir al carrito lo que tiene precio y esta disponible. */
export function canAddToCart(variant: Pick<Variant, 'price' | 'availability'>): boolean {
  return variant.availability === 'disponible' && variant.price > 0
}

/** Los selectores solo se muestran si la familia realmente usa ese atributo. */
export function variantAxes(variants: Variant[]): {
  sizes: string[]
  colors: string[]
  presentations: string[]
  saleUnits: string[]
} {
  const unique = (values: (string | null)[]) =>
    Array.from(new Set(values.filter((v): v is string => Boolean(v && v.trim()))))

  return {
    sizes: unique(variants.map((v) => v.size)),
    colors: unique(variants.map((v) => v.color)),
    presentations: unique(variants.map((v) => v.presentation)),
    saleUnits: unique(variants.map((v) => v.sale_unit)),
  }
}

export function buildCategoryTree(rows: Category[]): CategoryNode[] {
  const byId = new Map<string, CategoryNode>()
  for (const row of rows) byId.set(row.id, { ...row, children: [] })

  const roots: CategoryNode[] = []
  for (const node of byId.values()) {
    const parent = node.parent_id ? byId.get(node.parent_id) : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  }

  const sort = (nodes: CategoryNode[]) => {
    nodes.sort(
      (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'es'),
    )
    for (const node of nodes) sort(node.children)
  }
  sort(roots)

  return roots
}

/* ---------- Adaptadores desde filas de Supabase ---------- */

type VariantRow = Pick<
  Tables<'product_variants'>,
  | 'id'
  | 'origin_id'
  | 'size'
  | 'color'
  | 'presentation'
  | 'sale_unit'
  | 'price'
  | 'barcode'
  | 'availability'
>

export function toVariant(row: VariantRow): Variant {
  const availability = row.availability
  return {
    id: row.id,
    origin_id: row.origin_id,
    size: row.size,
    color: row.color,
    presentation: row.presentation,
    sale_unit: row.sale_unit,
    price: Number(row.price ?? 0),
    barcode: row.barcode,
    availability:
      availability === 'disponible' ||
      availability === 'agotado' ||
      availability === 'consultar'
        ? availability
        : 'consultar',
  }
}

export function toCategory(row: Tables<'categories'>): Category {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    parent_id: row.parent_id,
    sort_order: row.sort_order,
  }
}

/** Principal primero, luego el orden de carga. */
export function sortProductImages(images: ProductImage[]): ProductImage[] {
  return [...images].sort(
    (a, b) =>
      Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order,
  )
}

/** La imagen principal: la marcada is_primary, si no la de menor sort_order. */
export function pickPrimaryImage(images: ProductImage[]): string | null {
  return sortProductImages(images)[0]?.url ?? null
}
