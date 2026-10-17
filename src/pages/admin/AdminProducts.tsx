import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ButtonLink } from '@/components/Button'
import { ErrorState, Skeleton } from '@/components/States'
import { Pagination } from '@/components/Pagination'
import { AdminCard, Checkbox, FormError } from '@/features/admin/FormControls'
import { useAdminToast } from '@/features/admin/AdminToast'
import {
  QuickAvailabilityField,
  QuickPriceField,
} from '@/features/admin/QuickPriceField'
import { categoryBranchIds, fetchCategories } from '@/data/categories'
import {
  ADMIN_PAGE_SIZE,
  deleteProduct,
  fetchAdminCatalog,
  patchVariant,
  toggleProductFlag,
} from '@/data/admin'
import type { AdminListVariant, AdminProductRow } from '@/data/admin'
import { buildCategoryTree } from '@/lib/domain'
import type { Availability, CategoryNode } from '@/lib/domain'
import {
  ADMIN_PRODUCT_SORTS,
  filterAdminProducts,
  parseAdminProductSort,
  parseVariantIssue,
  sortAdminProducts,
} from '@/lib/adminProductQuery'
import { formatPrice, variantFullLabel } from '@/lib/format'
import { useAsync } from '@/lib/useAsync'
import { useDocumentMeta } from '@/lib/useDocumentMeta'

function priceRange(variants: AdminListVariant[]): string {
  const prices = variants.map((variant) => variant.price).filter((price) => price > 0)
  if (prices.length === 0) return 'Sin precio'
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  return min === max ? formatPrice(min) : `${formatPrice(min)} – ${formatPrice(max)}`
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`text-ink-500 size-4 shrink-0 transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
      aria-hidden="true"
    >
      <path d="M7 4.5 13 10 7 15.5" />
    </svg>
  )
}

function categoryOptions(nodes: CategoryNode[], depth = 0): {
  id: string
  label: string
}[] {
  return nodes.flatMap((node) => [
    { id: node.id, label: `${'— '.repeat(depth)}${node.name}` },
    ...categoryOptions(node.children, depth + 1),
  ])
}

export default function AdminProducts() {
  useDocumentMeta({ title: 'Productos | Administración', noIndex: true })
  const toast = useAdminToast()
  const [params, setParams] = useSearchParams()
  const variantIssue = parseVariantIssue(params.get('filtro'))
  const sort = parseAdminProductSort(params.get('orden'))

  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [onlyOffers, setOnlyOffers] = useState(false)
  const [onlyBestsellers, setOnlyBestsellers] = useState(false)
  const [page, setPage] = useState(1)
  const [actionError, setActionError] = useState<string | null>(null)

  const categories = useAsync(() => fetchCategories(), [])
  const catalog = useAsync(() => fetchAdminCatalog(), [])

  const categoryIds = useMemo(() => {
    if (!categoryId || !categories.data) return null
    return categoryBranchIds(categories.data, categoryId)
  }, [categoryId, categories.data])

  const visible = useMemo(() => {
    const items = catalog.data ?? []
    const filtered = filterAdminProducts(items, {
      search,
      categoryIds,
      onlyOffers,
      onlyBestsellers,
      variantIssue,
    })
    return sortAdminProducts(filtered, sort)
  }, [
    catalog.data,
    search,
    categoryIds,
    onlyOffers,
    onlyBestsellers,
    variantIssue,
    sort,
  ])

  const totalPages = Math.max(1, Math.ceil(visible.length / ADMIN_PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageItems = visible.slice(
    (safePage - 1) * ADMIN_PAGE_SIZE,
    safePage * ADMIN_PAGE_SIZE,
  )

  const options = categoryOptions(buildCategoryTree(categories.data ?? []))

  const patchRow = (
    productId: string,
    updater: (row: AdminProductRow) => AdminProductRow,
  ) => {
    catalog.setData((current) =>
      current?.map((row) => (row.id === productId ? updater(row) : row)),
    )
  }

  const toggleFlag = async (
    row: AdminProductRow,
    flag: 'is_offer' | 'is_bestseller',
    value: boolean,
  ) => {
    setActionError(null)
    patchRow(row.id, (current) => ({
      ...current,
      isOffer: flag === 'is_offer' ? value : current.isOffer,
      isBestseller: flag === 'is_bestseller' ? value : current.isBestseller,
    }))
    try {
      await toggleProductFlag(row.id, flag, value)
    } catch (cause) {
      patchRow(row.id, (current) => ({
        ...current,
        isOffer: flag === 'is_offer' ? !value : current.isOffer,
        isBestseller: flag === 'is_bestseller' ? !value : current.isBestseller,
      }))
      const message =
        cause instanceof Error ? cause.message : 'No se pudo cambiar.'
      setActionError(message)
      toast.error(message)
    }
  }

  const saveVariant = async (
    row: AdminProductRow,
    variant: AdminListVariant,
    patch: { price?: number; availability?: Availability },
  ) => {
    setActionError(null)
    const previous = variant
    patchRow(row.id, (current) => ({
      ...current,
      variants: current.variants.map((item) =>
        item.id === variant.id ? { ...item, ...patch } : item,
      ),
    }))
    try {
      await patchVariant(variant.id, patch)
    } catch (cause) {
      patchRow(row.id, (current) => ({
        ...current,
        variants: current.variants.map((item) =>
          item.id === variant.id ? previous : item,
        ),
      }))
      const message =
        cause instanceof Error ? cause.message : 'No se pudo actualizar.'
      setActionError(message)
      toast.error(message)
      throw cause
    }
  }

  const remove = async (row: AdminProductRow) => {
    setActionError(null)
    if (
      !window.confirm(
        `¿Borrar "${row.name}"?\n\nSe borran también sus ${row.variants.length} variante(s) y sus imágenes.`,
      )
    ) {
      return
    }
    try {
      await deleteProduct(row.id)
      catalog.setData((current) => current?.filter((item) => item.id !== row.id))
      toast.success(`Se borró "${row.name}".`)
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : 'No se pudo borrar.'
      setActionError(message)
      toast.error(message)
    }
  }

  const resetPage = <T,>(setter: (value: T) => void) => (value: T) => {
    setPage(1)
    setter(value)
  }

  const setQuery = (key: 'filtro' | 'orden', value: string) => {
    setPage(1)
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const firstLoad = catalog.loading && !catalog.data

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-ink-900 text-2xl font-extrabold">Productos</h1>
          <p className="text-ink-600 mt-1 text-sm">
            Si un producto tiene varias medidas, vienen cerradas. Ábrelas para
            cambiar el precio: escríbelo, pulsa Enter y pasa al siguiente con
            Tab.
          </p>
        </div>
        <ButtonLink to="/admin/productos/nuevo">Nuevo producto</ButtonLink>
      </div>

      <AdminCard>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <label
              htmlFor="admin-search"
              className="text-ink-800 mb-1.5 block text-sm font-semibold"
            >
              Buscar
            </label>
            <input
              id="admin-search"
              type="search"
              value={search}
              onChange={(event) => resetPage(setSearch)(event.target.value)}
              placeholder="Nombre, código o barras"
              className="admin-input"
            />
          </div>

          <div>
            <label
              htmlFor="admin-category"
              className="text-ink-800 mb-1.5 block text-sm font-semibold"
            >
              Categoría
            </label>
            <select
              id="admin-category"
              value={categoryId}
              onChange={(event) => resetPage(setCategoryId)(event.target.value)}
              className="admin-input"
            >
              <option value="">Todas</option>
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="admin-sort"
              className="text-ink-800 mb-1.5 block text-sm font-semibold"
            >
              Ordenar
            </label>
            <select
              id="admin-sort"
              value={sort}
              onChange={(event) => setQuery('orden', event.target.value)}
              className="admin-input"
            >
              {ADMIN_PRODUCT_SORTS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="admin-variant-issue"
              className="text-ink-800 mb-1.5 block text-sm font-semibold"
            >
              Estado
            </label>
            <select
              id="admin-variant-issue"
              value={variantIssue ?? ''}
              onChange={(event) => setQuery('filtro', event.target.value)}
              className="admin-input"
            >
              <option value="">Todos</option>
              <option value="agotado">Con stock agotado</option>
              <option value="sin-precio">Sin precio</option>
              <option value="consultar">En “consultar precio”</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-5">
          <Checkbox
            id="filter-offers"
            label="Solo ofertas"
            checked={onlyOffers}
            onChange={resetPage(setOnlyOffers)}
          />
          <Checkbox
            id="filter-bestsellers"
            label="Solo más vendidos"
            checked={onlyBestsellers}
            onChange={resetPage(setOnlyBestsellers)}
          />
        </div>
      </AdminCard>

      <p className="text-ink-600 -mt-2 text-sm">
        {catalog.data
          ? `${visible.length} de ${catalog.data.length} producto(s).`
          : 'Cargando catálogo…'}
      </p>

      {actionError ? <FormError>{actionError}</FormError> : null}

      {catalog.error ? (
        <ErrorState error={catalog.error} onRetry={catalog.reload} />
      ) : firstLoad ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-16" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <AdminCard>
          <p className="text-ink-600 text-sm">
            Ningún producto coincide con esos filtros.
          </p>
        </AdminCard>
      ) : (
        <>
          <ul className="space-y-2">
            {pageItems.map((row) => (
              <ProductRow
                key={`${row.id}-${variantIssue ?? 'todas'}`}
                row={row}
                startOpen={Boolean(variantIssue)}
                onToggleFlag={toggleFlag}
                onSaveVariant={saveVariant}
                onRemove={remove}
              />
            ))}
          </ul>

          <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />
        </>
      )}
    </div>
  )
}

function ProductRow({
  row,
  startOpen = false,
  onToggleFlag,
  onSaveVariant,
  onRemove,
}: {
  row: AdminProductRow
  /** Con un filtro de estado, las variantes arrancan abiertas. */
  startOpen?: boolean
  onToggleFlag: (
    row: AdminProductRow,
    flag: 'is_offer' | 'is_bestseller',
    value: boolean,
  ) => void
  onSaveVariant: (
    row: AdminProductRow,
    variant: AdminListVariant,
    patch: { price?: number; availability?: Availability },
  ) => Promise<void>
  onRemove: (row: AdminProductRow) => void
}) {
  const variants =
    row.variants.length > 0
      ? row.variants
      : [
          {
            id: `${row.id}-empty`,
            origin_id: null,
            size: null,
            color: null,
            presentation: null,
            sale_unit: null,
            price: 0,
            barcode: null,
            availability: 'consultar' as const,
          },
        ]
  const hasRealVariants = row.variants.length > 0
  const collapsible = row.variants.length > 1
  const [open, setOpen] = useState(startOpen)

  return (
    <li className="border-ink-100 rounded-card border bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-ink-900 font-semibold">{row.name}</p>
          <p className="text-ink-500 mt-0.5 text-xs">
            {row.origin_id ? `Código ${row.origin_id}` : 'Sin código'} ·{' '}
            {row.categoryName ?? 'Sin categoría'}
            {row.variants.length > 1
              ? ` · ${row.variants.length} variantes`
              : ''}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2">
          <Checkbox
            id={`offer-${row.id}`}
            label="Oferta"
            checked={row.isOffer}
            onChange={(value) => onToggleFlag(row, 'is_offer', value)}
          />
          <Checkbox
            id={`best-${row.id}`}
            label="Más vendido"
            checked={row.isBestseller}
            onChange={(value) => onToggleFlag(row, 'is_bestseller', value)}
          />
          <Link
            to={`/admin/productos/${row.id}`}
            className="text-brand-700 text-sm font-semibold underline"
          >
            Ficha
          </Link>
          <button
            type="button"
            onClick={() => onRemove(row)}
            className="text-sm font-semibold text-red-700 underline"
          >
            Borrar
          </button>
        </div>
      </div>

      <div className="border-ink-100 mt-3 overflow-hidden rounded-lg border">
        {collapsible ? (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls={`product-variants-${row.id}`}
            className="hover:bg-ink-50 flex w-full items-center gap-2 px-3 py-2.5 text-left"
          >
            <Chevron open={open} />
            <span className="text-ink-900 flex-1 text-sm font-semibold">
              {open ? 'Ocultar variantes' : `${row.variants.length} variantes`}
            </span>
            {open ? null : (
              <span className="text-ink-500 text-xs font-medium tabular-nums">
                {priceRange(row.variants)}
              </span>
            )}
          </button>
        ) : null}

        {collapsible && !open ? null : (
          <ul
            id={`product-variants-${row.id}`}
            className={collapsible ? 'border-ink-100 divide-y border-t' : 'divide-y'}
          >
            {variants.map((variant) => {
              const label = variantFullLabel(variant) || 'Variante única'
              return (
                <li
                  key={variant.id}
                  className="flex flex-wrap items-center gap-3 px-3 py-2.5"
                >
                  <p className="text-ink-800 min-w-[10rem] flex-1 text-sm">
                    {hasRealVariants ? label : 'Este producto no tiene variantes'}
                    {variant.origin_id ? (
                      <span className="text-ink-500"> · {variant.origin_id}</span>
                    ) : null}
                  </p>

                  {hasRealVariants ? (
                    <>
                      <QuickPriceField
                        value={variant.price}
                        ariaLabel={`Precio de ${row.name} ${label}`}
                        onSave={(price) => onSaveVariant(row, variant, { price })}
                      />
                      <QuickAvailabilityField
                        value={variant.availability}
                        ariaLabel={`Disponibilidad de ${row.name} ${label}`}
                        onSave={(availability) =>
                          onSaveVariant(row, variant, { availability })
                        }
                      />
                    </>
                  ) : (
                    <Link
                      to={`/admin/productos/${row.id}`}
                      className="text-brand-700 text-sm font-semibold underline"
                    >
                      Añadir variante y precio
                    </Link>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </li>
  )
}
