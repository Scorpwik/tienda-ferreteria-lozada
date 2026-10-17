import { describe, expect, it } from 'vitest'
import {
  catalogImportSchema,
  normalizeImportedCatalog,
  resolveImportAvailability,
} from './validation'

function toVariantRow(
  productId: string,
  variant: ReturnType<typeof normalizeImportedCatalog>['products'][number]['variants'][number],
) {
  const price = variant.precio ?? 0
  return {
    product_id: productId,
    origin_id: variant.id_origen ?? null,
    size: variant.medida,
    color: variant.color,
    presentation: variant.presentacion,
    sale_unit: variant.forma_venta,
    price,
    barcode: variant.codigo_barra,
    availability: resolveImportAvailability(variant.precio, variant.availability),
  }
}

describe('importador de catálogo (precios y variantes)', () => {
  it('convierte un SKU plano (sin variants[]) en una variante con precio publicado', () => {
    const parsed = catalogImportSchema.safeParse({
      products: [
        {
          id_origen: 3184077644,
          nombre: 'Abrazadera de cobre',
          medida: null,
          color: null,
          presentacion: null,
          forma_venta: 'unidad',
          precio: 0.5,
          codigo_barra: '001321',
        },
      ],
    })
    expect(parsed.success).toBe(true)
    if (!parsed.success) return

    const catalog = normalizeImportedCatalog(parsed.data)
    expect(catalog.products).toHaveLength(1)
    expect(catalog.products[0]?.variants).toHaveLength(1)

    const row = toVariantRow('uuid-producto', catalog.products[0]!.variants[0]!)
    expect(row).toMatchObject({
      origin_id: 3184077644,
      sale_unit: 'unidad',
      price: 0.5,
      barcode: '001321',
      availability: 'disponible',
    })
  })

  it('recupera la talla 10-04 del nombre si el JSON vino sin medida', () => {
    const parsed = catalogImportSchema.safeParse({
      products: [
        {
          id_origen: 1053083248,
          nombre: 'Abrazadera Titan 10-04',
          variantes: [
            {
              id_origen: 2477450501,
              nombre: 'Abrazadera Titan 10-04',
              medida: null,
              forma_venta: 'unidad',
              precio: 0.5,
            },
            {
              id_origen: 3121842967,
              nombre: 'Abrazadera Titan 30-64',
              medida: null,
              forma_venta: 'unidad',
              precio: 2.15,
            },
          ],
        },
      ],
    })
    expect(parsed.success).toBe(true)
    if (!parsed.success) return

    const catalog = normalizeImportedCatalog(parsed.data)
    expect(catalog.products[0]?.nombre).toBe('Abrazadera Titan')
    expect(catalog.products[0]?.variants.map((v) => v.medida)).toEqual(['10-04', '30-64'])
  })

  it('agrupa SKUs del mismo nombre como variantes de un solo producto', () => {
    const parsed = catalogImportSchema.safeParse({
      products: [
        {
          id_origen: 11,
          nombre: 'Tornillo para madera',
          categoria_id: 'tornillos',
          medida: '6x2',
          forma_venta: 'ciento',
          precio: 1.25,
        },
        {
          id_origen: 12,
          nombre: 'Tornillo para madera',
          categoria_id: 'tornillos',
          medida: '8x2',
          forma_venta: 'ciento',
          precio: 1.5,
        },
      ],
    })
    expect(parsed.success).toBe(true)
    if (!parsed.success) return

    const catalog = normalizeImportedCatalog(parsed.data)
    expect(catalog.products).toHaveLength(1)
    expect(catalog.products[0]?.variants.map((v) => v.precio)).toEqual([1.25, 1.5])
    expect(catalog.products[0]?.variants.map((v) => v.medida)).toEqual(['6x2', '8x2'])
  })

  it('respeta variants[] anidadas y no fuerza availability a consultar', () => {
    const parsed = catalogImportSchema.safeParse({
      products: [
        {
          id_origen: 1855,
          nombre: 'Tornillo para madera',
          variantes: [
            {
              id_origen: 185501,
              medida: '6x2',
              forma_venta: 'ciento',
              precio: 1.25,
            },
          ],
        },
      ],
    })
    expect(parsed.success).toBe(true)
    if (!parsed.success) return

    const variant = parsed.data.products[0]?.variants[0]
    expect(variant?.precio).toBe(1.25)
    expect(variant?.availability).toBeUndefined()
    expect(resolveImportAvailability(variant?.precio, variant?.availability)).toBe(
      'disponible',
    )
  })

  it('si el precio es 0 y no hay availability, queda en consultar', () => {
    expect(resolveImportAvailability(0)).toBe('consultar')
    expect(resolveImportAvailability(null)).toBe('consultar')
    expect(resolveImportAvailability(2, 'agotado')).toBe('agotado')
  })
})
