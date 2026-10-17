import { supabase } from '@/lib/supabase'
import { toVariant } from '@/lib/domain'
import type { Availability, Variant } from '@/lib/domain'
import type { AdminListVariant, AdminProductRow } from '@/lib/adminProductQuery'
import {
  categoryFormSchema,
  parseOrThrow,
  productFormSchema,
  productImageUrlSchema,
  variantFormSchema,
  variantPatchSchema,
} from '@/lib/validation'
import {
  extensionFor,
  storagePathFromUrl,
  validateImageFile,
} from '@/lib/images'
import type { TablesInsert } from '@/lib/types.database'

/**
 * Acceso a datos del panel. Todo pasa por la anon key y las politicas RLS:
 * si la sesion no esta en admins, la base rechaza la escritura aunque la
 * interfaz se equivoque.
 */

/* ---------- Errores legibles ---------- */

/** Traduce los codigos de Postgres a algo que el dueño del negocio entienda. */
export function readableDbError(error: unknown): string {
  const record = error as { code?: string; message?: string } | null
  const code = record?.code ?? ''
  const message = record?.message ?? ''

  if (code === '23505' || message.includes('duplicate key')) {
    if (message.includes('slug')) return 'Ya existe una categoría con esa URL.'
    if (message.includes('products_origin_id')) {
      return 'Ya existe un producto con ese código.'
    }
    if (message.includes('product_variants_origin_id')) {
      return 'Ya existe una variante con ese código.'
    }
    return 'Ese registro ya existe.'
  }

  if (code === '23514') {
    return 'Alguno de los valores no es válido para la base.'
  }
  if (code === '23503') {
    return 'Ese elemento está enlazado con otro registro y no se puede borrar así.'
  }
  if (code === '42501' || code === '403') {
    return 'Tu cuenta no tiene permiso para esta acción.'
  }
  if (code === '22003') {
    return 'El número es demasiado grande para ese campo.'
  }

  return message || 'No se pudo guardar. Intenta otra vez.'
}

/**
 * Con RLS, un UPDATE o DELETE sin permiso no da error: afecta 0 filas y el
 * panel diria "guardado" sin que nada haya cambiado. Cada escritura pide las
 * filas de vuelta (.select('id')) y aqui se comprueba que hubo alguna.
 */
function assertAffected(rows: unknown[] | null, action: string): void {
  if (!rows || rows.length === 0) {
    throw new Error(
      `No se pudo ${action}: el registro ya no existe o tu cuenta no tiene permiso.`,
    )
  }
}

/* ---------- Categorias ---------- */

export type CategoryFormValues = {
  name: string
  slug: string
  parent_id: string | null
  sort_order: number
}

export async function createCategory(values: CategoryFormValues): Promise<void> {
  const payload = parseOrThrow(categoryFormSchema, values)
  const { error } = await supabase.from('categories').insert(payload)
  if (error) throw new Error(readableDbError(error))
}

export async function updateCategory(
  id: string,
  values: CategoryFormValues,
): Promise<void> {
  const payload = parseOrThrow(categoryFormSchema, values)

  // Una categoria no puede ser su propia madre.
  if (payload.parent_id === id) {
    throw new Error('Una categoría no puede depender de sí misma.')
  }

  // Tampoco puede colgar de una de sus propias descendientes (A -> B -> A):
  // un ciclo deja a las dos fuera del arbol y desaparecen del catalogo.
  if (payload.parent_id) {
    const { data: all, error: readError } = await supabase
      .from('categories')
      .select('id, parent_id')
    if (readError) throw new Error(readableDbError(readError))

    const parentOf = new Map((all ?? []).map((row) => [row.id, row.parent_id]))
    const seen = new Set<string>()
    let cursor: string | null | undefined = payload.parent_id
    while (cursor && !seen.has(cursor)) {
      if (cursor === id) {
        throw new Error('Esa categoría madre es una de sus propias subcategorías.')
      }
      seen.add(cursor)
      cursor = parentOf.get(cursor)
    }
  }

  const { data, error } = await supabase
    .from('categories')
    .update(payload)
    .eq('id', id)
    .select('id')
  if (error) throw new Error(readableDbError(error))
  assertAffected(data, 'guardar la categoría')
}

/** Reescribe sort_order de un grupo de hermanas (0, 1, 2…) según el orden visual. */
export async function reorderCategories(orderedIds: string[]): Promise<void> {
  if (orderedIds.length === 0) return

  const results = await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from('categories').update({ sort_order: index }).eq('id', id).select('id'),
    ),
  )

  const failed = results.find((result) => result.error)
  if (failed?.error) throw new Error(readableDbError(failed.error))
}

/**
 * El FK de products.category_id no tiene ON DELETE CASCADE, asi que se avisa
 * antes: borrar una categoria con productos dejaria el catalogo sin clasificar.
 */
export async function countCategoryUsage(
  id: string,
): Promise<{ products: number; children: number }> {
  const [products, children] = await Promise.all([
    supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', id),
    supabase
      .from('categories')
      .select('id', { count: 'exact', head: true })
      .eq('parent_id', id),
  ])

  // Sin esto, un error de lectura se veria como "0 productos" y la advertencia
  // de la confirmacion diria que borrar es inofensivo.
  if (products.error) throw new Error(readableDbError(products.error))
  if (children.error) throw new Error(readableDbError(children.error))

  return { products: products.count ?? 0, children: children.count ?? 0 }
}

/**
 * Borra la categoria. Primero desengancha sus productos y subcategorias, tal
 * como avisa la confirmacion del panel: no dependemos de que el FK tenga
 * ON DELETE SET NULL. Si el borrado final falla, lo desenganchado queda sin
 * categoria, que es un estado valido y facil de reasignar.
 */
export async function deleteCategory(id: string): Promise<void> {
  const detachProducts = await supabase
    .from('products')
    .update({ category_id: null })
    .eq('category_id', id)
  if (detachProducts.error) throw new Error(readableDbError(detachProducts.error))

  const detachChildren = await supabase
    .from('categories')
    .update({ parent_id: null })
    .eq('parent_id', id)
  if (detachChildren.error) throw new Error(readableDbError(detachChildren.error))

  const { data, error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id)
    .select('id')
  if (error) throw new Error(readableDbError(error))
  assertAffected(data, 'borrar la categoría')
}

/* ---------- Productos ---------- */

export type { AdminProductRow, AdminListVariant } from '@/lib/adminProductQuery'

const ADMIN_LIST_SELECT = `
  id, origin_id, name, category_id, is_offer, is_bestseller, updated_at,
  category:categories!products_category_id_fkey ( name ),
  product_variants ( id, origin_id, size, color, presentation, sale_unit, price, barcode, availability )
` as const

type AdminListRow = {
  id: string
  origin_id: number | null
  name: string
  category_id: string | null
  is_offer: boolean
  is_bestseller: boolean
  updated_at: string
  category: { name: string } | null
  product_variants: {
    id: string
    origin_id: number | null
    size: string | null
    color: string | null
    presentation: string | null
    sale_unit: string | null
    price: number | null
    barcode: string | null
    availability: string
  }[]
}

function toAdminListVariant(
  row: AdminListRow['product_variants'][number],
): AdminListVariant {
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

function toAdminProductRow(row: AdminListRow): AdminProductRow {
  return {
    id: row.id,
    origin_id: row.origin_id,
    name: row.name,
    categoryId: row.category_id,
    categoryName: row.category?.name ?? null,
    isOffer: row.is_offer,
    isBestseller: row.is_bestseller,
    updatedAt: row.updated_at,
    variants: row.product_variants.map(toAdminListVariant),
  }
}

export const ADMIN_PAGE_SIZE = 40
const ADMIN_FETCH_PAGE = 1000

/**
 * Todo el catalogo para el panel. ~1.200 productos caben en memoria y asi
 * filtrar, ordenar y cambiar un precio no vuelve a pedir la pagina al servidor.
 */
export async function fetchAdminCatalog(): Promise<AdminProductRow[]> {
  const items: AdminProductRow[] = []
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from('products')
      .select(ADMIN_LIST_SELECT)
      .order('id')
      .order('created_at', { referencedTable: 'product_variants' })
      .range(from, from + ADMIN_FETCH_PAGE - 1)

    if (error) throw error

    const rows = (data as unknown as AdminListRow[]) ?? []
    items.push(...rows.map(toAdminProductRow))
    if (rows.length < ADMIN_FETCH_PAGE) break
    from += ADMIN_FETCH_PAGE
  }

  return items
}

export type ProductFormValues = {
  name: string
  origin_id: number | null
  description: string | null
  category_id: string | null
  is_offer: boolean
  is_bestseller: boolean
}

export async function createProduct(values: ProductFormValues): Promise<string> {
  const payload = parseOrThrow(productFormSchema, values)
  const { data, error } = await supabase
    .from('products')
    .insert(payload)
    .select('id')
    .single()

  if (error) throw new Error(readableDbError(error))
  return data.id
}

export async function updateProduct(
  id: string,
  values: ProductFormValues,
): Promise<void> {
  const payload = parseOrThrow(productFormSchema, values)
  const { data, error } = await supabase
    .from('products')
    .update(payload)
    .eq('id', id)
    .select('id')
  if (error) throw new Error(readableDbError(error))
  assertAffected(data, 'guardar el producto')
}

export async function deleteProduct(id: string): Promise<void> {
  // Se leen las rutas antes: al borrar el producto las filas de product_images
  // desaparecen y ya no sabriamos que archivos limpiar del bucket.
  const { data: images } = await supabase
    .from('product_images')
    .select('url')
    .eq('product_id', id)

  const { data: removed, error } = await supabase
    .from('products')
    .delete()
    .eq('id', id)
    .select('id')
  if (error) throw new Error(readableDbError(error))
  assertAffected(removed, 'borrar el producto')

  const paths = (images ?? [])
    .map((image) => storagePathFromUrl(image.url, PRODUCT_IMAGES_BUCKET))
    .filter((path): path is string => path !== null)

  // Si esto falla quedan archivos huerfanos, pero el catalogo ya esta bien.
  if (paths.length > 0) {
    await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove(paths)
  }
}

/** Alterna oferta o mas vendido desde el listado, sin abrir la ficha. */
export async function toggleProductFlag(
  id: string,
  flag: 'is_offer' | 'is_bestseller',
  value: boolean,
): Promise<void> {
  // Objeto literal por rama: con una clave calculada TypeScript pierde el tipo.
  const patch = flag === 'is_offer' ? { is_offer: value } : { is_bestseller: value }
  const { data, error } = await supabase
    .from('products')
    .update(patch)
    .eq('id', id)
    .select('id')
  if (error) throw new Error(readableDbError(error))
  assertAffected(data, 'cambiar el producto')
}

/* ---------- Variantes ---------- */

export type VariantFormValues = {
  origin_id: number | null
  size: string | null
  color: string | null
  presentation: string | null
  sale_unit: string | null
  price: number
  barcode: string | null
  availability: Availability
}

export async function createVariant(
  productId: string,
  values: VariantFormValues,
): Promise<void> {
  const payload = parseOrThrow(variantFormSchema, values)
  const { error } = await supabase
    .from('product_variants')
    .insert({ ...payload, product_id: productId })
  if (error) throw new Error(readableDbError(error))
}

export async function updateVariant(
  id: string,
  values: VariantFormValues,
): Promise<void> {
  const payload = parseOrThrow(variantFormSchema, values)
  const { data, error } = await supabase
    .from('product_variants')
    .update(payload)
    .eq('id', id)
    .select('id')
  if (error) throw new Error(readableDbError(error))
  assertAffected(data, 'guardar la variante')
}

export async function deleteVariant(id: string): Promise<void> {
  const { data, error } = await supabase
    .from('product_variants')
    .delete()
    .eq('id', id)
    .select('id')
  if (error) throw new Error(readableDbError(error))
  assertAffected(data, 'borrar la variante')
}

/** Cambio rapido de precio o disponibilidad desde la tabla de variantes. */
export async function patchVariant(
  id: string,
  patch: { price?: number; availability?: Availability },
): Promise<void> {
  const checked = parseOrThrow(variantPatchSchema, patch)
  const { data, error } = await supabase
    .from('product_variants')
    .update(checked)
    .eq('id', id)
    .select('id')
  if (error) throw new Error(readableDbError(error))
  assertAffected(data, 'actualizar la variante')
}

export async function fetchProductVariants(
  productId: string,
): Promise<Variant[]> {
  const { data, error } = await supabase
    .from('product_variants')
    .select(
      'id, origin_id, size, color, presentation, sale_unit, price, barcode, availability',
    )
    .eq('product_id', productId)
    .order('created_at')

  if (error) throw error
  return (data ?? []).map(toVariant)
}

/* ---------- Imagenes ---------- */

export const PRODUCT_IMAGES_BUCKET = 'product-images'

/**
 * Sube un archivo al bucket publico y devuelve su ruta y URL. Valida tipo y
 * peso en el cliente para no gastar la cuota del plan gratuito con archivos
 * que la ficha no va a poder mostrar (el bucket tambien deberia limitarlos).
 */
async function uploadToBucket(
  folder: string,
  file: File,
): Promise<{ path: string; publicUrl: string }> {
  const problem = validateImageFile(file)
  if (problem) throw new Error(problem)

  const path = `${folder}/${crypto.randomUUID()}.${extensionFor(file.type)}`

  const { error: uploadError } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false })

  if (uploadError) throw new Error(readableDbError(uploadError))

  const { data } = supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(path)
  return { path, publicUrl: data.publicUrl }
}

/** Imagen suelta del sitio (logo, portada). Vive en la carpeta site/. */
export async function uploadSiteImage(file: File): Promise<string> {
  const { publicUrl } = await uploadToBucket('site', file)
  return publicUrl
}

/** Sube al bucket publico en una carpeta (promotions, site, etc.). */
export async function uploadPublicImage(
  folder: string,
  file: File,
): Promise<string> {
  const { publicUrl } = await uploadToBucket(folder, file)
  return publicUrl
}

/** Borra del bucket si la URL es nuestra; las URLs externas se ignoran. */
export async function removePublicImage(url: string): Promise<void> {
  const path = storagePathFromUrl(url, PRODUCT_IMAGES_BUCKET)
  if (!path) return
  await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([path])
}

type ProductImageOptions = {
  variantId?: string | null
  isPrimary?: boolean
}

/**
 * Inserta una fila en product_images. La primera imagen del producto queda
 * principal por defecto; si se pide isPrimary con otras ya existentes, se
 * limpia la marca anterior para no tener dos principales.
 */
async function insertProductImageRow(
  productId: string,
  url: string,
  options: ProductImageOptions = {},
): Promise<void> {
  const { data: last } = await supabase
    .from('product_images')
    .select('sort_order')
    .eq('product_id', productId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { count } = await supabase
    .from('product_images')
    .select('id', { count: 'exact', head: true })
    .eq('product_id', productId)

  // Primera imagen del producto = principal, aunque no marquen el checkbox.
  // `??` no sirve: el panel siempre manda `isPrimary: false` si está desmarcado.
  const isPrimary = Boolean(options.isPrimary) || (count ?? 0) === 0

  if (isPrimary && (count ?? 0) > 0) {
    const { error: clearError } = await supabase
      .from('product_images')
      .update({ is_primary: false })
      .eq('product_id', productId)

    if (clearError) throw new Error(readableDbError(clearError))
  }

  const row: TablesInsert<'product_images'> = {
    product_id: productId,
    variant_id: options.variantId ?? null,
    url,
    is_primary: isPrimary,
    // Siguiente al mayor existente: contar filas repetiria orden tras borrados.
    sort_order: last ? last.sort_order + 1 : 0,
  }

  const { error } = await supabase.from('product_images').insert(row)
  if (error) throw new Error(readableDbError(error))
}

/** Sube la imagen de un producto y registra su fila en product_images. */
export async function uploadProductImage(
  productId: string,
  file: File,
  options: ProductImageOptions = {},
): Promise<void> {
  const { path, publicUrl } = await uploadToBucket(productId, file)

  try {
    await insertProductImageRow(productId, publicUrl, options)
  } catch (cause) {
    // Si la fila no entra, el archivo subido seria basura en el bucket.
    await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([path])
    throw cause
  }
}

/**
 * Guarda una URL externa en product_images sin descargar ni subir al bucket.
 * Sirve para pegar enlaces de imagenes ya alojadas en otro sitio.
 */
export async function addProductImageFromUrl(
  productId: string,
  rawUrl: string,
  options: ProductImageOptions = {},
): Promise<void> {
  const url = parseOrThrow(productImageUrlSchema, rawUrl)
  await insertProductImageRow(productId, url, options)
}

export async function setPrimaryImage(
  productId: string,
  imageId: string,
): Promise<void> {
  const { error: clearError } = await supabase
    .from('product_images')
    .update({ is_primary: false })
    .eq('product_id', productId)

  if (clearError) throw new Error(readableDbError(clearError))

  const { data, error } = await supabase
    .from('product_images')
    .update({ is_primary: true })
    .eq('id', imageId)
    .select('id')

  if (error) throw new Error(readableDbError(error))
  assertAffected(data, 'cambiar la imagen principal')
}

export async function deleteProductImage(
  imageId: string,
  url: string,
): Promise<void> {
  const { data: current } = await supabase
    .from('product_images')
    .select('product_id, is_primary')
    .eq('id', imageId)
    .maybeSingle()

  const { data: removed, error } = await supabase
    .from('product_images')
    .delete()
    .eq('id', imageId)
    .select('id')

  if (error) throw new Error(readableDbError(error))
  assertAffected(removed, 'borrar la imagen')

  // Si se borra la principal, la siguiente pasa a serlo: sin esto el catalogo
  // mostraria una foto "cualquiera" segun el orden y el panel ninguna marcada.
  if (current?.is_primary && current.product_id) {
    const { data: next } = await supabase
      .from('product_images')
      .select('id')
      .eq('product_id', current.product_id)
      .order('sort_order')
      .limit(1)
      .maybeSingle()

    if (next) {
      await supabase
        .from('product_images')
        .update({ is_primary: true })
        .eq('id', next.id)
    }
  }

  // El archivo se borra despues: si falla, queda huerfano pero la ficha ya
  // esta correcta, que es lo que ve el cliente.
  const path = storagePathFromUrl(url, PRODUCT_IMAGES_BUCKET)
  if (path) {
    await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([path])
  }
}
