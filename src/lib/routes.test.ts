import { describe, expect, it } from 'vitest'
import { parseProductParam, productPath } from './routes'

describe('parseProductParam', () => {
  it('acepta un id corto de facturación', () => {
    expect(parseProductParam('1855-tornillo-para-madera')).toEqual({
      kind: 'origin',
      originId: 1855,
    })
  })

  it('acepta el crc32 de 10 cifras que usa el normalizador', () => {
    expect(parseProductParam('1053083248-abrazadera-titan')).toEqual({
      kind: 'origin',
      originId: 1053083248,
    })
  })

  it('acepta un origin_id de 10 cifras sin sufijo', () => {
    expect(parseProductParam('1053083248')).toEqual({
      kind: 'origin',
      originId: 1053083248,
    })
  })

  it('acepta un uuid', () => {
    expect(
      parseProductParam('a1b2c3d4-e5f6-7890-abcd-ef1234567890-nombre'),
    ).toEqual({
      kind: 'id',
      id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    })
  })
})

describe('productPath', () => {
  it('arma la URL con origin_id de 10 cifras', () => {
    expect(
      productPath({
        id: 'uuid',
        origin_id: 1053083248,
        name: 'Abrazadera Titan',
      }),
    ).toBe('/producto/1053083248-abrazadera-titan')
  })
})
