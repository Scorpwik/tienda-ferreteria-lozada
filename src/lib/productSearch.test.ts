import { describe, expect, it } from 'vitest'
import {
  buildProductSearchDoc,
  normalizeSearchText,
  rankSearchHit,
  searchAllTokensMatch,
  searchTokenMatches,
  searchTokens,
} from './productSearch'

describe('productSearch', () => {
  it('parte la consulta y unifica pulgadas y colores', () => {
    expect(searchTokens('amoladora 9 pulgadas')).toEqual([
      'amoladora',
      '9',
      'pulg',
    ])
    expect(searchTokens('Spray BLANCA')).toEqual(['spray', 'blanco'])
    expect(searchTokens('amoladora de 9"')).toEqual(['amoladora', '9', 'pulg'])
  })

  it('ignora conectores y tildes', () => {
    expect(searchTokens('tornillo para madera')).toEqual(['tornillo', 'madera'])
    expect(normalizeSearchText('Inalámbrica')).toBe('inalambrica')
  })

  it('cruza nombre + medida y nombre + color', () => {
    const amoladora = buildProductSearchDoc({
      name: 'Amoladora Emtop ULAGR22093',
      categoryName: 'Amoladoras',
      variants: [{ size: '9 pulgadas' }],
    })
    expect(searchAllTokensMatch(amoladora, searchTokens('amoladora 9 pulgadas'))).toBe(
      true,
    )
    expect(searchAllTokensMatch(amoladora, searchTokens('spray blanco'))).toBe(false)

    const spray = buildProductSearchDoc({
      name: 'Spray Evans',
      categoryName: 'Aerosoles',
      searchTags: ['spray', 'evans', 'blanco'],
      variants: [{ color: 'blanco' }, { color: 'amarillo' }],
    })
    expect(searchAllTokensMatch(spray, searchTokens('spray blanco'))).toBe(true)
    expect(searchAllTokensMatch(spray, searchTokens('spray rojo'))).toBe(false)
  })

  it('no trata un 9 suelto como parte de 900w o del codigo', () => {
    expect(searchTokenMatches(normalizeSearchText('900w'), '9')).toBe(false)
    expect(searchTokenMatches(normalizeSearchText('ULAGR22093'), '9')).toBe(false)
    expect(searchTokenMatches(normalizeSearchText('9 pulgadas'), '9')).toBe(true)
    expect(searchTokenMatches(normalizeSearchText('4 1/2 1100w'), '1/2')).toBe(true)
  })

  it('prioriza cuando el nombre ya trae las palabras', () => {
    expect(rankSearchHit('Spray Evans', searchTokens('spray blanco'))).toBe(1)
    expect(rankSearchHit('Spray blanco mate', searchTokens('spray blanco'))).toBe(0)
    expect(rankSearchHit('Pintura esmalte', searchTokens('spray blanco'))).toBe(2)
  })
})
