import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Button, ButtonLink } from '@/components/Button'
import { EmptyState, ErrorState, Skeleton } from '@/components/States'
import {
  AdminCard,
  Checkbox,
  Field,
  FormError,
  FormSuccess,
} from '@/features/admin/FormControls'
import { useAdminToast } from '@/features/admin/AdminToast'
import { ImageManager } from '@/features/admin/ImageManager'
import { VariantEditor } from '@/features/admin/VariantEditor'
import { fetchCategories } from '@/data/categories'
import { fetchProductById } from '@/data/products'
import { createProduct, deleteProduct, updateProduct } from '@/data/admin'
import type { ProductFormValues } from '@/data/admin'
import { buildCategoryTree } from '@/lib/domain'
import type { CategoryNode, ProductDetail } from '@/lib/domain'
import { productFormSchema, validateFields } from '@/lib/validation'
import type { FieldErrors } from '@/lib/validation'
import { useAsync } from '@/lib/useAsync'
import { useDocumentMeta } from '@/lib/useDocumentMeta'

function flatten(nodes: CategoryNode[], depth = 0): { id: string; label: string }[] {
  return nodes.flatMap((node) => [
    { id: node.id, label: `${'— '.repeat(depth)}${node.name}` },
    ...flatten(node.children, depth + 1),
  ])
}

type FormState = {
  name: string
  origin_id: string
  description: string
  category_id: string
  is_offer: boolean
  is_bestseller: boolean
}

const emptyForm: FormState = {
  name: '',
  origin_id: '',
  description: '',
  category_id: '',
  is_offer: false,
  is_bestseller: false,
}

function fromProduct(product: ProductDetail): FormState {
  return {
    name: product.name,
    origin_id: product.origin_id ? String(product.origin_id) : '',
    description: product.description ?? '',
    category_id: product.category?.id ?? '',
    is_offer: product.isOffer,
    is_bestseller: product.isBestseller,
  }
}

/** Convierte lo escrito en el formulario a lo que esperan validacion y base. */
function toValues(form: FormState): ProductFormValues {
  const origin = form.origin_id.trim()
  return {
    name: form.name,
    origin_id: origin === '' ? null : Number(origin),
    description: form.description,
    category_id: form.category_id || null,
    is_offer: form.is_offer,
    is_bestseller: form.is_bestseller,
  }
}

function ProductForm({
  initial,
  productId,
  categories,
  onSaved,
}: {
  initial: FormState
  /** null cuando se esta creando. */
  productId: string | null
  categories: CategoryNode[]
  onSaved: (id: string, created: boolean) => void
}) {
  const toast = useAdminToast()
  const [form, setForm] = useState<FormState>(initial)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const options = useMemo(() => flatten(categories), [categories])
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError(null)

    const values = toValues(form)

    // El codigo debe ser un entero positivo: el esquema lo convertiria en null
    // en silencio, y el producto quedaria sin codigo sin que nadie lo note.
    const origin = form.origin_id.trim()
    if (origin !== '' && !/^[1-9]\d*$/.test(origin)) {
      setErrors({ origin_id: 'Debe ser un número entero mayor a cero.' })
      setFormError('Revisa los campos marcados.')
      return
    }

    const checked = validateFields(productFormSchema, values)
    if (!checked.ok) {
      setErrors(checked.errors)
      setFormError('Revisa los campos marcados.')
      return
    }
    setErrors({})

    setBusy(true)
    try {
      if (productId) {
        await updateProduct(productId, values)
        toast.success(`Listo: se guardó "${values.name}".`)
        onSaved(productId, false)
      } else {
        const id = await createProduct(values)
        toast.success(`Producto creado. Ahora añade variantes e imágenes.`)
        onSaved(id, true)
      }
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : 'No se pudo guardar.'
      setFormError(message)
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AdminCard title="Datos del producto">
      <form onSubmit={(event) => void submit(event)} className="space-y-4" noValidate>
        <Field label="Nombre" htmlFor="product-name" error={errors.name}>
          <input
            id="product-name"
            value={form.name}
            onChange={(event) => set('name', event.target.value)}
            aria-invalid={Boolean(errors.name)}
            className="admin-input"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Código del sistema"
            htmlFor="product-origin"
            error={errors.origin_id}
            hint="El ID del producto en la facturación. Es la dirección de la ficha (/producto/1855)."
          >
            <input
              id="product-origin"
              inputMode="numeric"
              value={form.origin_id}
              onChange={(event) => set('origin_id', event.target.value)}
              aria-invalid={Boolean(errors.origin_id)}
              className="admin-input"
            />
          </Field>

          <Field label="Categoría" htmlFor="product-category" error={errors.category_id}>
            <select
              id="product-category"
              value={form.category_id}
              onChange={(event) => set('category_id', event.target.value)}
              className="admin-input"
            >
              <option value="">Sin categoría</option>
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field
          label="Descripción"
          htmlFor="product-description"
          error={errors.description}
          hint="Opcional. Para qué sirve, materiales, usos."
        >
          <textarea
            id="product-description"
            rows={4}
            value={form.description}
            onChange={(event) => set('description', event.target.value)}
            className="admin-input"
          />
        </Field>

        <div className="flex flex-wrap gap-6">
          <Checkbox
            id="product-offer"
            label="Está en oferta"
            checked={form.is_offer}
            onChange={(value) => set('is_offer', value)}
          />
          <Checkbox
            id="product-bestseller"
            label="Es de los más vendidos"
            checked={form.is_bestseller}
            onChange={(value) => set('is_bestseller', value)}
          />
        </div>

        {formError ? <FormError>{formError}</FormError> : null}

        <Button type="submit" disabled={busy}>
          {busy ? 'Guardando…' : productId ? 'Guardar cambios' : 'Crear producto'}
        </Button>
      </form>
    </AdminCard>
  )
}

function AdminProductEdit() {
  const { id } = useParams<{ id: string }>()
  const productId = id && id !== 'nuevo' ? id : null
  const navigate = useNavigate()
  const location = useLocation()

  const toast = useAdminToast()
  const [notice, setNotice] = useState<string | null>(
    (location.state as { notice?: string } | null)?.notice ?? null,
  )
  const [actionError, setActionError] = useState<string | null>(null)

  const categories = useAsync(() => fetchCategories(), [])
  const product = useAsync<ProductDetail | null>(
    () => (productId ? fetchProductById(productId) : Promise.resolve(null)),
    [productId],
  )

  useDocumentMeta({
    title: `${productId ? 'Editar producto' : 'Nuevo producto'} | Administración`,
    noIndex: true,
  })

  const tree = useMemo(() => buildCategoryTree(categories.data ?? []), [categories.data])

  const remove = async () => {
    if (!product.data) return
    const detail = `Se borran también sus ${product.data.variants.length} variante(s) y sus imágenes.`
    if (!window.confirm(`¿Borrar "${product.data.name}"?\n\n${detail}`)) return

    setActionError(null)
    try {
      const name = product.data.name
      await deleteProduct(product.data.id)
      toast.success(`Se borró "${name}".`)
      navigate('/admin/productos', { replace: true })
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : 'No se pudo borrar.'
      setActionError(message)
      toast.error(message)
    }
  }

  const header = (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <Link to="/admin/productos" className="text-brand-700 text-sm font-semibold underline">
          ← Volver a productos
        </Link>
        <h1 className="text-ink-900 mt-2 text-2xl font-extrabold">
          {productId ? (product.data?.name ?? 'Editar producto') : 'Nuevo producto'}
        </h1>
      </div>

      {productId && product.data ? (
        <div className="flex items-center gap-4 text-sm font-semibold">
          {product.data.origin_id ? (
            <a
              href={`/producto/${product.data.origin_id}`}
              target="_blank"
              rel="noreferrer"
              className="text-brand-700 underline"
            >
              Ver en la tienda
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => void remove()}
            className="text-red-700 underline"
          >
            Borrar producto
          </button>
        </div>
      ) : null}
    </div>
  )

  if (categories.error) {
    return <ErrorState error={categories.error} onRetry={categories.reload} />
  }
  if (product.error) {
    return <ErrorState error={product.error} onRetry={product.reload} />
  }

  // Solo se muestra el esqueleto la primera vez: al recargar tras cambiar una
  // variante o una imagen, la pagina no debe parpadear ni perder lo escrito.
  const firstLoad =
    categories.loading && !categories.data
      ? true
      : productId !== null && product.loading && !product.data
  if (firstLoad) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-72" />
      </div>
    )
  }

  if (productId && !product.data) {
    return (
      <EmptyState
        title="Ese producto no existe"
        description="Puede que lo hayan borrado. Vuelve a la lista para elegir otro."
        action={<ButtonLink to="/admin/productos">Ir a productos</ButtonLink>}
      />
    )
  }

  return (
    <div className="space-y-6">
      {header}

      {notice ? <FormSuccess>{notice}</FormSuccess> : null}
      {actionError ? <FormError>{actionError}</FormError> : null}

      {productId && product.data ? (
        <VariantEditor
          productId={productId}
          variants={product.data.variants}
          onChanged={product.reload}
        />
      ) : null}

      <ProductForm
        key={productId ?? 'nuevo'}
        initial={product.data ? fromProduct(product.data) : emptyForm}
        productId={productId}
        categories={tree}
        onSaved={(savedId, created) => {
          if (created) {
            navigate(`/admin/productos/${savedId}`, {
              replace: true,
              state: {
                notice: 'Producto creado. Ahora añade sus variantes y sus imágenes.',
              },
            })
          } else {
            setNotice('Cambios guardados.')
            product.reload()
          }
        }}
      />

      {productId && product.data ? (
        <ImageManager
          productId={productId}
          images={product.data.images}
          variants={product.data.variants}
          onChanged={product.reload}
        />
      ) : (
        <AdminCard>
          <p className="text-ink-600 text-sm">
            Guarda el producto para poder añadirle variantes (medidas, precios) e
            imágenes.
          </p>
        </AdminCard>
      )}
    </div>
  )
}

/** El key remonta la pagina al pasar de /nuevo a /:id o entre productos. */
export default function AdminProductEditRoute() {
  const { id } = useParams<{ id: string }>()
  return <AdminProductEdit key={id ?? 'nuevo'} />
}
