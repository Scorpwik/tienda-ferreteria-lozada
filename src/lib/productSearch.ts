const STOP_WORDS = new Set([
  'de',
  'del',
  'la',
  'el',
  'los',
  'las',
  'un',
  'una',
  'uno',
  'y',
  'o',
  'para',
  'con',
  'en',
  'a',
  'al',
  'por',
  'que',
  'the',
  'of',
])

const WORD_SYNONYMS: [RegExp, string][] = [
  [/\b(?:pulgadas|pulgada|pulg|inches|inch|in)\b/g, 'pulg'],
  [/\b(?:milimetros|milimetro|mms?)\b/g, 'mm'],
  [/\b(?:centimetros|centimetro|cms?)\b/g, 'cm'],
  [/\b(?:galones|galon|gals?)\b/g, 'galon'],
  [/\b(?:litros|litro|lts?)\b/g, 'litro'],
  [/\b(?:inalambricas|inalambricos|inalambrica|inalambrico)\b/g, 'inalambrica'],
  [/\b(?:blancas|blancos|blanca|blanco)\b/g, 'blanco'],
  [/\b(?:negras|negros|negra|negro)\b/g, 'negro'],
  [/\b(?:rojas|rojos|roja|rojo)\b/g, 'rojo'],
  [/\b(?:amarillas|amarillos|amarilla|amarillo)\b/g, 'amarillo'],
  [/\b(?:verdes|verde)\b/g, 'verde'],
  [/\b(?:azules|azul)\b/g, 'azul'],
  [/\b(?:grises|gris)\b/g, 'gris'],
]

export function foldSearchText(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

/** Quita tildes, unifica pulgadas/colores y deja tokens comparables. */
export function normalizeSearchText(raw: string): string {
  let text = foldSearchText(raw)
  text = text.replace(/(\d)\s*["″]+/g, '$1 pulg')
  for (const [pattern, replacement] of WORD_SYNONYMS) {
    text = text.replace(pattern, replacement)
  }
  return text.replace(/[^a-z0-9./-]+/g, ' ').replace(/\s+/g, ' ').trim()
}

export function searchTokens(raw: string): string[] {
  return normalizeSearchText(raw)
    .split(/\s+/)
    .filter((token) => token.length > 0 && !STOP_WORDS.has(token))
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function searchTokenMatches(doc: string, token: string): boolean {
  if (!token) return true
  const escaped = escapeRegex(token)
  if (/^[0-9./-]+$/.test(token) || token.length <= 2) {
    return new RegExp(`(^|[^a-z0-9])${escaped}([^0-9]|$)`).test(doc)
  }
  return new RegExp(`(^|[^a-z0-9])${escaped}`).test(doc)
}

export function searchAllTokensMatch(doc: string, tokens: string[]): boolean {
  return tokens.every((token) => searchTokenMatches(doc, token))
}

export type SearchVariantFields = {
  size?: string | null
  color?: string | null
  presentation?: string | null
  saleUnit?: string | null
  barcode?: string | null
  originId?: number | null
}

export function buildProductSearchDoc(input: {
  name: string
  description?: string | null
  searchTags?: string[] | null
  originId?: number | null
  categoryName?: string | null
  variants: SearchVariantFields[]
}): string {
  const parts = [
    input.name,
    input.description,
    ...(input.searchTags ?? []),
    input.categoryName,
    input.originId != null ? String(input.originId) : '',
    ...input.variants.flatMap((variant) => [
      variant.size,
      variant.color,
      variant.presentation,
      variant.saleUnit,
      variant.barcode,
      variant.originId != null ? String(variant.originId) : '',
    ]),
  ]
  return normalizeSearchText(parts.filter(Boolean).join(' '))
}

export function rankSearchHit(name: string, tokens: string[]): number {
  const nameNorm = normalizeSearchText(name)
  if (searchAllTokensMatch(nameNorm, tokens)) return 0
  if (tokens[0] && searchTokenMatches(nameNorm, tokens[0])) return 1
  return 2
}
