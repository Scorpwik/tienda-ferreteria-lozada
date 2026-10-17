import { z } from 'zod'
import { cleanClientName, cleanMultiLine, cleanSingleLine } from './sanitize'

/**
 * Esquemas compartidos entre el frontend y la Edge Function.
 * El frontend valida para dar buen feedback; el servidor vuelve a validar
 * porque nunca se confia en lo que llega del navegador.
 */

/** Campo de texto opcional: vacio se guarda como null, no como ''. */
function optionalLine(maxLength: number) {
  return z
    .union([z.string(), z.null()])
    .optional()
    .transform((value) => {
      if (value == null) return null
      const cleaned = cleanSingleLine(value, maxLength)
      return cleaned.length > 0 ? cleaned : null
    })
}

function optionalParagraph(maxLength: number) {
  return z
    .union([z.string(), z.null()])
    .optional()
    .transform((value) => {
      if (value == null) return null
      const cleaned = cleanMultiLine(value, maxLength)
      return cleaned.length > 0 ? cleaned : null
    })
}

export const clientNameSchema = z
  .string()
  .transform(cleanClientName)
  .refine((v) => v.length >= 3, 'Escribe tu nombre (al menos 3 letras).')
  .refine((v) => /\p{L}/u.test(v), 'El nombre debe contener al menos una letra.')

/** Enteros positivos por ahora; fracciones (metro/litro) se pueden reabrir luego. */
export const quantitySchema = z.coerce
  .number()
  .refine(Number.isFinite, 'Cantidad invalida.')
  .refine((v) => Number.isInteger(v), 'La cantidad debe ser un numero entero.')
  .refine((v) => v >= 1, 'La cantidad minima es 1.')
  .refine(
    (v) => v <= 100000,
    'Cantidad demasiado alta. Escribenos por WhatsApp.',
  )
  .transform((v) => Math.round(v))

export const quoteItemSchema = z.object({
  variant_id: z.uuid('Identificador de variante invalido.'),
  quantity: quantitySchema,
})

export const createQuoteSchema = z.object({
  client_name: clientNameSchema,
  items: z
    .array(quoteItemSchema)
    .min(1, 'El carrito esta vacio.')
    .max(80, 'Demasiadas lineas. Escribenos por WhatsApp para pedidos grandes.'),
})

export type CreateQuoteInput = z.infer<typeof createQuoteSchema>

export const searchQuerySchema = z
  .string()
  .transform((v) => cleanSingleLine(v, 60))

export const availabilitySchema = z.enum([
  'disponible',
  'agotado',
  'consultar',
])

/* ---------- Esquemas del panel admin ---------- */

export const categoryFormSchema = z.object({
  name: z
    .string()
    .transform((v) => cleanSingleLine(v, 80))
    .refine((v) => v.length >= 2, 'El nombre es obligatorio.'),
  slug: z
    .string()
    .transform((v) => cleanSingleLine(v, 80).toLowerCase())
    .refine(
      (v) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v),
      'Usa solo minusculas, numeros y guiones.',
    ),
  parent_id: z.uuid().nullable(),
  sort_order: z.coerce.number().int().min(0).max(9999),
})

export type CategoryFormInput = z.input<typeof categoryFormSchema>

export const productFormSchema = z.object({
  name: z
    .string()
    .transform((v) => cleanSingleLine(v, 160))
    .refine((v) => v.length >= 2, 'El nombre es obligatorio.'),
  origin_id: z
    .union([z.coerce.number().int().positive(), z.null()])
    .catch(null),
  description: optionalParagraph(2000),
  category_id: z.uuid().nullable(),
  is_offer: z.boolean(),
  is_bestseller: z.boolean(),
})

export const variantFormSchema = z.object({
  origin_id: z
    .union([z.coerce.number().int().positive(), z.null()])
    .catch(null),
  size: optionalLine(60),
  color: optionalLine(40),
  presentation: optionalLine(60),
  sale_unit: optionalLine(30),
  price: z.coerce
    .number()
    .refine((v) => v >= 0, 'El precio no puede ser negativo.')
    .refine((v) => v <= 1000000, 'Precio fuera de rango.'),
  barcode: optionalLine(40),
  availability: availabilitySchema,
})

/** Cambio rapido desde la tabla de variantes: solo precio y/o disponibilidad. */
export const variantPatchSchema = z
  .object({
    price: z.coerce
      .number()
      .refine(Number.isFinite, 'Precio inválido.')
      .refine((v) => v >= 0, 'El precio no puede ser negativo.')
      .refine((v) => v <= 1000000, 'Precio fuera de rango.')
      .optional(),
    availability: availabilitySchema.optional(),
  })
  .refine(
    (v) => v.price !== undefined || v.availability !== undefined,
    'No hay nada que cambiar.',
  )

export const settingTextSchema = z
  .string()
  .transform((v) => cleanMultiLine(v, 4000))

/**
 * Convierte un error de Zod en un Error con el primer mensaje legible.
 * Sin esto, el panel mostraria el JSON crudo de Zod al usuario.
 */
export function parseOrThrow<S extends z.ZodType>(
  schema: S,
  input: unknown,
): z.output<S> {
  const result = schema.safeParse(input)
  if (result.success) return result.data
  throw new Error(result.error.issues[0]?.message ?? 'Datos inválidos.')
}

export type FieldErrors = Record<string, string>

/** Valida y devuelve un mensaje por campo, con la ruta como clave ("hero.title"). */
export function validateFields<S extends z.ZodType>(
  schema: S,
  input: unknown,
): { ok: true; data: z.output<S> } | { ok: false; errors: FieldErrors } {
  const result = schema.safeParse(input)
  if (result.success) return { ok: true, data: result.data }

  const errors: FieldErrors = {}
  for (const issue of result.error.issues) {
    const key = issue.path.join('.')
    if (!(key in errors)) errors[key] = issue.message
  }
  return { ok: false, errors }
}

/* ---------- Ajustes del sitio (site_settings) ---------- */

function requiredLine(label: string, min: number, max: number) {
  return z
    .string()
    .transform((v) => cleanSingleLine(v, max))
    .refine((v) => v.length >= min, `${label} es obligatorio.`)
}

function looseLine(max: number) {
  return z.string().transform((v) => cleanSingleLine(v, max))
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

/** URL opcional: vacia o https. Rechaza javascript:, data: y http plano. */
const httpsUrlOrEmpty = z
  .string()
  .transform((v) => v.trim().slice(0, 600))
  .refine(
    (v) => v === '' || isHttpsUrl(v),
    'Debe ser una dirección completa que empiece con https://',
  )

/** URL https obligatoria para pegar una imagen de producto sin subir archivo. */
export const productImageUrlSchema = z
  .string()
  .transform((v) => v.trim().slice(0, 600))
  .refine((v) => v.length > 0, 'Pega la dirección de la imagen.')
  .refine(
    (v) => isHttpsUrl(v),
    'Debe ser una dirección completa que empiece con https://',
  )

const isoDate = z
  .string()
  .transform((v) => v.trim())
  .refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v), 'Elige una fecha válida.')

/** Combo/promoción temporal. El precio es texto libre, no un número de inventario. */
export const promotionFormSchema = z
  .object({
    title: z
      .string()
      .transform((v) => cleanSingleLine(v, 120))
      .refine((v) => v.length >= 2, 'El título es obligatorio.'),
    description: optionalParagraph(280),
    price_label: optionalLine(40),
    image_url: productImageUrlSchema,
    start_date: isoDate,
    end_date: isoDate,
  })
  .refine((value) => value.end_date >= value.start_date, {
    path: ['end_date'],
    message: 'La fecha de fin no puede ser anterior al inicio.',
  })

export type PromotionFormValues = z.infer<typeof promotionFormSchema>

/**
 * Zod ejecuta todos los refine aunque uno anterior haya fallado, asi que este
 * no puede asumir que la URL ya es valida: new URL() lanzaria un TypeError.
 */
function isGoogleUrl(value: string): boolean {
  try {
    return /(^|\.)google\.[a-z.]+$/.test(new URL(value).hostname)
  } catch {
    return false
  }
}

const mapsEmbedUrl = httpsUrlOrEmpty.refine(
  (v) => v === '' || !isHttpsUrl(v) || isGoogleUrl(v),
  'Debe ser un enlace de Google Maps.',
)

export const contactSettingsSchema = z.object({
  business_name: requiredLine('El nombre del negocio', 2, 80),
  whatsapp_number: z
    .string()
    .transform((v) => v.replace(/\D/g, ''))
    .refine(
      (v) => v.length >= 10 && v.length <= 15,
      'Escríbelo con código de país y sin signos. Ejemplo: 593995307272',
    ),
  whatsapp_display: requiredLine('El número visible', 6, 40),
  address: requiredLine('La dirección', 5, 200),
  maps_embed_url: mapsEmbedUrl,
  quote_validity_days: z.coerce
    .number()
    .refine(Number.isInteger, 'Debe ser un número entero.')
    .refine((v) => v >= 1 && v <= 90, 'Entre 1 y 90 días.'),
})

export const scheduleSettingsSchema = z.object({
  weekdays: requiredLine('El horario de lunes a viernes', 1, 120),
  saturday: requiredLine('El horario del sábado', 1, 120),
  sunday: requiredLine('El horario del domingo', 1, 120),
  holidays: requiredLine('La nota de feriados', 1, 160),
})

export const heroSettingsSchema = z.object({
  title: requiredLine('El título', 2, 120),
  subtitle: requiredLine('El subtítulo', 2, 300),
  image_desktop_url: httpsUrlOrEmpty,
  image_mobile_url: httpsUrlOrEmpty,
  image_alt: requiredLine('El texto alternativo', 2, 160),
  primary_cta: requiredLine('El texto del botón principal', 2, 40),
  secondary_cta: requiredLine('El texto del botón secundario', 2, 40),
})

export const aboutGalleryItemSchema = z.object({
  url: httpsUrlOrEmpty.refine((v) => v.length > 0, 'Sube una foto.'),
  alt: requiredLine('La descripción de la foto', 2, 160),
  caption: looseLine(120),
})

export const aboutGallerySchema = z
  .array(aboutGalleryItemSchema)
  .max(8, 'Máximo 8 fotos en la galería.')

export const processStepSchema = z.object({
  title: requiredLine('El título del paso', 1, 60),
  text: looseLine(240),
})

export const processSettingsSchema = z
  .array(processStepSchema)
  .max(6, 'Máximo 6 pasos.')

export const aboutSettingsSchema = z.object({
  about_history: z.string().transform((v) => cleanMultiLine(v, 4000)),
  about_coverage: z.string().transform((v) => cleanMultiLine(v, 2000)),
})

export const socialNetworks = ['facebook', 'instagram', 'tiktok'] as const

export const socialSettingsSchema = z
  .object({
    facebook: httpsUrlOrEmpty,
    instagram: httpsUrlOrEmpty,
    tiktok: httpsUrlOrEmpty,
  })
  .transform((value) =>
    // Las redes vacias no se guardan: parseSettings las ignoraria igual.
    Object.fromEntries(Object.entries(value).filter(([, url]) => url !== '')),
  )

export const brandSettingsSchema = z.object({
  logo_url: httpsUrlOrEmpty,
  seo_title: requiredLine('El título para Google', 5, 70),
  seo_description: requiredLine('La descripción para Google', 10, 200),
  seo_og_image: httpsUrlOrEmpty,
})

/* ---------- Importador de catalogo ---------- */

/**
 * El normalizador usa ids temporales de texto (no UUID). Aqui se aceptan
 * como string o number; el importador los mapea a los UUID reales de la base.
 */
const importRefId = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .refine((value) => value.length > 0, 'El id de categoria es obligatorio.')

/**
 * Claves del JSON del normalizador (español): `nombre`, `id_origen`, etc.
 * El upsert a Supabase mapea a columnas en inglés (`name`, `origin_id`).
 */
export const importCategorySchema = z.object({
  id: importRefId,
  nombre: z
    .string()
    .transform((v) => cleanSingleLine(v, 80))
    .refine((v) => v.length >= 2, 'El nombre de categoria es obligatorio.'),
  slug: z
    .string()
    .transform((v) => cleanSingleLine(v, 80).toLowerCase())
    .optional(),
  parent_id: importRefId.nullish(),
  sort_order: z.coerce.number().int().min(0).max(9999).optional(),
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

const importPrecio = z.coerce
  .number()
  .refine((v) => v >= 0, 'El precio no puede ser negativo.')
  .refine((v) => v <= 1000000, 'Precio fuera de rango.')
  .nullish()
  .catch(null)

/**
 * Variantes del normalizador (claves en español).
 * Upsert: id_origen→origin_id, medida→size, presentacion→presentation,
 * forma_venta→sale_unit, precio→price, codigo_barra→barcode.
 * No forzar availability: si falta, el importador publica 'disponible'
 * cuando hay precio > 0. `.catch('consultar')` ocultaba todos los precios.
 */
export const importVariantSchema = z.object({
  id_origen: z.coerce.number().int().positive().nullish().catch(null),
  nombre: optionalLine(160),
  medida: optionalLine(60),
  color: optionalLine(40),
  presentacion: optionalLine(60),
  forma_venta: optionalLine(30),
  precio: importPrecio,
  codigo_barra: optionalLine(40),
  availability: availabilitySchema.optional(),
})

/**
 * Campos SEO opcionales del normalizador. Si la clave no viene en el JSON,
 * queda `undefined` y el upsert no la toca (no borra lo ya guardado).
 */
function optionalImportLine(maxLength: number) {
  return z
    .union([z.string(), z.null()])
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined
      if (value == null) return null
      const cleaned = cleanSingleLine(value, maxLength)
      return cleaned.length > 0 ? cleaned : null
    })
}

function optionalImportParagraph(maxLength: number) {
  return z
    .union([z.string(), z.null()])
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined
      if (value == null) return null
      const cleaned = cleanMultiLine(value, maxLength)
      return cleaned.length > 0 ? cleaned : null
    })
}

const optionalSearchTags = z
  .union([z.array(z.string()), z.null()])
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined
    if (value == null) return null
    const cleaned = value
      .map((tag) => cleanSingleLine(tag, 60))
      .filter((tag) => tag.length > 0)
    return cleaned.length > 0 ? cleaned : null
  })

export const importProductSchema = z.preprocess(
  (raw) => {
    if (!isRecord(raw)) return raw
    return {
      ...raw,
      description: raw.description ?? raw.descripcion,
      variants: raw.variants ?? raw.variantes,
    }
  },
  z.object({
    id_origen: z.coerce
      .number()
      .int()
      .positive('Cada producto necesita un id_origen del sistema de facturacion.'),
    nombre: z
      .string()
      .transform((v) => cleanSingleLine(v, 160))
      .refine((v) => v.length >= 2, 'El nombre del producto es obligatorio.'),
    categoria_id: importRefId.nullish(),
    description: optionalParagraph(2000),
    slug: optionalImportLine(160),
    meta_title: optionalImportLine(70),
    meta_description: optionalImportParagraph(320),
    search_tags: optionalSearchTags,
    // El normalizador a veces pone el SKU en el producto, sin array variants.
    medida: optionalLine(60),
    color: optionalLine(40),
    presentacion: optionalLine(60),
    forma_venta: optionalLine(30),
    precio: importPrecio,
    codigo_barra: optionalLine(40),
    variants: z.array(importVariantSchema).default([]),
  }),
)

export const catalogImportSchema = z.preprocess(
  (raw) => {
    if (!isRecord(raw)) return raw
    const inner = isRecord(raw.catalog) ? raw.catalog : raw
    if (!isRecord(inner)) return inner
    return {
      ...inner,
      categories: inner.categories ?? inner.categorias,
      products: inner.products ?? inner.productos,
    }
  },
  z.object({
    categories: z.array(importCategorySchema).default([]),
    products: z
      .array(importProductSchema)
      .max(5000, 'Máximo 5000 productos por importación. Divide el JSON en partes.'),
  }),
)

export type CatalogImport = z.infer<typeof catalogImportSchema>
export type ImportProduct = z.infer<typeof importProductSchema>
export type ImportVariant = z.infer<typeof importVariantSchema>

/** Talla tipo 10-04 / 48-52 al final del nombre (abrazaderas Titan, tee 3-2). */
const trailingRangeSize = /(?:^|[\s-])(\d+(?:[.,]\d+)?-\d+(?:[.,]\d+)?)\s*$/

export function inferSizeFromName(
  medida: string | null | undefined,
  nombre: string | null | undefined,
): string | null {
  const existing = medida?.trim() ?? ''
  if (existing.length > 0) return existing
  if (!nombre) return null
  const match = nombre.trim().match(trailingRangeSize)
  return match?.[1]?.replace(',', '.') ?? null
}

function stripTrailingSize(nombre: string, sizes: string[]): string {
  let next = nombre.trim()
  const unique = [...new Set(sizes.filter(Boolean))].sort((a, b) => b.length - a.length)
  for (const size of unique) {
    const escaped = size.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = new RegExp(`[\\s-]+${escaped}$`, 'i')
    if (pattern.test(next)) {
      const stripped = next.replace(pattern, '').trim()
      if (stripped.length >= 2) return stripped
    }
  }
  return next
}

function skuVariantFromProduct(product: ImportProduct): ImportVariant {
  return {
    id_origen: product.id_origen,
    nombre: product.nombre,
    medida: product.medida ?? null,
    color: product.color ?? null,
    presentacion: product.presentacion ?? null,
    forma_venta: product.forma_venta ?? null,
    precio: product.precio ?? null,
    codigo_barra: product.codigo_barra ?? null,
    availability: undefined,
  }
}

/**
 * El JSON real a menudo es una lista plana de SKUs (precio/medida en el
 * producto, sin `variants[]`). La tienda solo muestra precio desde
 * `product_variants`, así que aquí se agrupa por nombre+categoría y se
 * crea una variante por cada SKU.
 */
export function normalizeImportedCatalog(catalog: CatalogImport): CatalogImport {
  const families: ImportProduct[] = []
  const buckets = new Map<string, ImportProduct[]>()

  for (const product of catalog.products) {
    if (product.variants.length > 0) {
      families.push(product)
      continue
    }
    const key = `${product.nombre.toLowerCase()}::${product.categoria_id ?? ''}`
    const list = buckets.get(key) ?? []
    list.push(product)
    buckets.set(key, list)
  }

  for (const list of buckets.values()) {
    const head = list[0]
    if (!head) continue
    families.push({
      ...head,
      variants: list.map(skuVariantFromProduct),
    })
  }

  const repaired = families.map((product) => {
    const variants = product.variants.map((variant) => ({
      ...variant,
      medida: inferSizeFromName(variant.medida, variant.nombre ?? product.nombre),
    }))
    const sizes = variants
      .map((variant) => variant.medida)
      .filter((size): size is string => Boolean(size))
    return {
      ...product,
      nombre: sizes.length > 0 ? stripTrailingSize(product.nombre, sizes) : product.nombre,
      variants,
    }
  })

  return { ...catalog, products: repaired }
}

/** Si el JSON no trae availability, publicar precio cuando es > 0. */
export function resolveImportAvailability(
  precio: number | null | undefined,
  availability?: (typeof availabilitySchema)['_output'],
): (typeof availabilitySchema)['_output'] {
  if (availability) return availability
  return (precio ?? 0) > 0 ? 'disponible' : 'consultar'
}
