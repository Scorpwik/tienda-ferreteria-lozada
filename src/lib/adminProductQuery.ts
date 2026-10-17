import { variantFullLabel } from './format'
import type { Availability } from './domain'

export type AdminListVariant = {
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

export type AdminProductRow = {
  id: string
  origin_id: number | null
  name: string
  categoryId: string | null
  categoryName: string | null
  isOffer: boolean
  isBestseller: boolean
  updatedAt: string
  variants: AdminListVariant[]
}

export type AdminProductSort =
  | 'name'
  | 'price-desc'
  | 'price-asc'
  | 'updated'
  | 'code'

export type AdminVariantIssue = 'agotado' | 'sin-precio' | 'consultar'

export type AdminProductFilters = {
  search: string
  categoryIds: string[] | null
  onlyOffers: boolean
  onlyBestsellers: boolean
  variantIssue: AdminVariantIssue | null
}

export const ADMIN_PRODUCT_SORTS: { id: AdminProductSort; label: string }[] = [
  { id: 'name', label: 'Nombre A-Z' },
  { id: 'price-desc', label: 'Precio: más caro primero' },
  { id: 'price-asc', label: 'Precio: más barato primero' },
  { id: 'updated', label: 'Últimos cambios' },
  { id: 'code', label: 'Código' },
]

export function parseAdminProductSort(
  value: string | null,
): AdminProductSort {
  if (
    value === 'name' ||
    value === 'price-desc' ||
    value === 'price-asc' ||
    value === 'updated' ||
    value === 'code'
  ) {
    return value
  }
  return 'name'
}

export function parseVariantIssue(
  value: string | null,
): AdminVariantIssue | null {
  if (value === 'agotado' || value === 'sin-precio' || value === 'consultar') {
    return value
  }
  return null
}

export function minPrice(row: AdminProductRow): number {
  const priced = row.variants.map((variant) => variant.price).filter((price) => price > 0)
  return priced.length > 0 ? Math.min(...priced) : 0
}

export function maxPrice(row: AdminProductRow): number {
  if (row.variants.length === 0) return 0
  return Math.max(...row.variants.map((variant) => variant.price), 0)
}

function matchesSearch(row: AdminProductRow, term: string): boolean {
  const needle = term.trim().toLowerCase()
  if (!needle) return true

  if (row.name.toLowerCase().includes(needle)) return true
  if (row.categoryName?.toLowerCase().includes(needle)) return true
  if (row.origin_id != null && String(row.origin_id).startsWith(needle)) return true

  return row.variants.some((variant) => {
    if (variant.origin_id != null && String(variant.origin_id).startsWith(needle)) {
      return true
    }
    if (variant.barcode?.toLowerCase().includes(needle)) return true
    return variantFullLabel(variant).toLowerCase().includes(needle)
  })
}

export function filterAdminProducts(
  items: AdminProductRow[],
  filters: AdminProductFilters,
): AdminProductRow[] {
  return items.filter((row) => {
    if (filters.onlyOffers && !row.isOffer) return false
    if (filters.onlyBestsellers && !row.isBestseller) return false
    if (filters.categoryIds) {
      if (!row.categoryId || !filters.categoryIds.includes(row.categoryId)) {
        return false
      }
    }
    if (filters.variantIssue === 'agotado') {
      if (!row.variants.some((variant) => variant.availability === 'agotado')) {
        return false
      }
    } else if (filters.variantIssue === 'sin-precio') {
      if (!row.variants.some((variant) => variant.price <= 0)) return false
    } else if (filters.variantIssue === 'consultar') {
      if (!row.variants.some((variant) => variant.availability === 'consultar')) {
        return false
      }
    }
    return matchesSearch(row, filters.search)
  })
}

export function sortAdminProducts(
  items: AdminProductRow[],
  sort: AdminProductSort,
): AdminProductRow[] {
  const copy = [...items]
  copy.sort((a, b) => {
    switch (sort) {
      case 'price-desc': {
        const diff = maxPrice(b) - maxPrice(a)
        return diff !== 0 ? diff : a.name.localeCompare(b.name, 'es')
      }
      case 'price-asc': {
        const aPrice = minPrice(a)
        const bPrice = minPrice(b)
        if (aPrice !== bPrice) return aPrice - bPrice
        return a.name.localeCompare(b.name, 'es')
      }
      case 'updated': {
        const diff = b.updatedAt.localeCompare(a.updatedAt)
        return diff !== 0 ? diff : a.name.localeCompare(b.name, 'es')
      }
      case 'code': {
        if (a.origin_id == null && b.origin_id == null) {
          return a.name.localeCompare(b.name, 'es')
        }
        if (a.origin_id == null) return 1
        if (b.origin_id == null) return -1
        if (a.origin_id !== b.origin_id) return a.origin_id - b.origin_id
        return a.name.localeCompare(b.name, 'es')
      }
      default:
        return a.name.localeCompare(b.name, 'es')
    }
  })
  return copy
}
