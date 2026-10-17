import { describe, expect, it } from 'vitest'
import {
  filterAdminProducts,
  maxPrice,
  minPrice,
  parseAdminProductSort,
  sortAdminProducts,
} from './adminProductQuery'
import type { AdminProductRow } from './adminProductQuery'

function row(
  partial: Partial<AdminProductRow> & Pick<AdminProductRow, 'id' | 'name'>,
): AdminProductRow {
  return {
    origin_id: null,
    categoryId: null,
    categoryName: null,
    isOffer: false,
    isBestseller: false,
    updatedAt: '2026-01-01T00:00:00Z',
    variants: [],
    ...partial,
  }
}

const drill = row({
  id: '1',
  name: 'Taladro Ingco',
  origin_id: 100,
  categoryId: 'cat-a',
  categoryName: 'Herramientas',
  isOffer: true,
  variants: [
    {
      id: 'v1',
      origin_id: 11,
      size: '20V',
      color: null,
      presentation: null,
      sale_unit: 'unidad',
      price: 45,
      barcode: '78001',
      availability: 'disponible',
    },
  ],
})

const screw = row({
  id: '2',
  name: 'Tornillo 4x1',
  origin_id: 200,
  categoryId: 'cat-b',
  categoryName: 'Fijaciones',
  updatedAt: '2026-06-01T00:00:00Z',
  variants: [
    {
      id: 'v2',
      origin_id: 22,
      size: '4x1',
      color: null,
      presentation: 'Caja',
      sale_unit: 'caja',
      price: 1.5,
      barcode: null,
      availability: 'agotado',
    },
    {
      id: 'v3',
      origin_id: 23,
      size: '5x1',
      color: null,
      presentation: 'Caja',
      sale_unit: 'caja',
      price: 0,
      barcode: null,
      availability: 'disponible',
    },
  ],
})

describe('adminProductQuery', () => {
  it('calcula el precio mínimo y máximo ignorando ceros en el mínimo', () => {
    expect(minPrice(screw)).toBe(1.5)
    expect(maxPrice(screw)).toBe(1.5)
    expect(minPrice(drill)).toBe(45)
  })

  it('filtra por búsqueda de nombre, código y variante', () => {
    const items = [drill, screw]
    expect(filterAdminProducts(items, base({ search: 'taladro' })).map((r) => r.id)).toEqual([
      '1',
    ])
    expect(filterAdminProducts(items, base({ search: '200' })).map((r) => r.id)).toEqual(['2'])
    expect(filterAdminProducts(items, base({ search: '78001' })).map((r) => r.id)).toEqual(['1'])
    expect(filterAdminProducts(items, base({ search: '4x1' })).map((r) => r.id)).toEqual(['2'])
  })

  it('filtra ofertas, categoría, agotados y sin precio', () => {
    const items = [drill, screw]
    expect(
      filterAdminProducts(items, base({ onlyOffers: true })).map((r) => r.id),
    ).toEqual(['1'])
    expect(
      filterAdminProducts(items, base({ categoryIds: ['cat-b'] })).map((r) => r.id),
    ).toEqual(['2'])
    expect(
      filterAdminProducts(items, base({ variantIssue: 'agotado' })).map((r) => r.id),
    ).toEqual(['2'])
    expect(
      filterAdminProducts(items, base({ variantIssue: 'sin-precio' })).map((r) => r.id),
    ).toEqual(['2'])
  })

  it('ordena por precio caro a barato y por nombre', () => {
    const items = [screw, drill]
    expect(sortAdminProducts(items, 'price-desc').map((r) => r.id)).toEqual(['1', '2'])
    expect(sortAdminProducts(items, 'price-asc').map((r) => r.id)).toEqual(['2', '1'])
    expect(sortAdminProducts(items, 'name').map((r) => r.id)).toEqual(['1', '2'])
  })

  it('acepta solo valores de orden conocidos', () => {
    expect(parseAdminProductSort('price-desc')).toBe('price-desc')
    expect(parseAdminProductSort('nope')).toBe('name')
  })
})

function base(
  patch: Partial<Parameters<typeof filterAdminProducts>[1]>,
): Parameters<typeof filterAdminProducts>[1] {
  return {
    search: '',
    categoryIds: null,
    onlyOffers: false,
    onlyBestsellers: false,
    variantIssue: null,
    ...patch,
  }
}
