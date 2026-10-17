import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ProductGrid } from './ProductGrid'
import { SearchBar } from './SearchBar'
import { Filters } from './Filters'
import { EmptyState, ErrorState, Spinner } from '@/components/States'
import { Button, ButtonLink } from '@/components/Button'
import {
  fetchCatalogPage,
  fetchCatalogPriceCeiling,
  PAGE_SIZE,
} from '@/data/products'
import { isAvailability } from '@/lib/format'
import type { ProductCard } from '@/lib/domain'

function parsePriceParam(raw: string | null): number | null {
  if (raw == null || raw === '') return null
  const value = Number(raw)
  return Number.isFinite(value) && value >= 0 ? value : null
}

/**
 * Listado del catálogo con "Cargar más" (no scroll infinito):
 * en celulares de obra es más predecible y barato que un IntersectionObserver
 * disparando páginas al pasar el pulgar.
 */
export function CatalogBrowser({
  categoryIds = null,
}: {
  categoryIds?: string[] | null
}) {
  const [params, setParams] = useSearchParams()
  const [priceCeiling, setPriceCeiling] = useState(100)

  const search = params.get('q') ?? ''
  const availabilityParam = params.get('disp') ?? ''
  const availability = isAvailability(availabilityParam)
    ? availabilityParam
    : null
  const onlyOffers = params.get('oferta') === '1'
  const onlyBestsellers = params.get('mas-vendidos') === '1'
  const priceMin = parsePriceParam(params.get('pmin'))
  const priceMax = parsePriceParam(params.get('pmax'))

  const categoryKey = categoryIds?.join(',') ?? ''
  const filterKey = [
    search,
    categoryKey,
    availability ?? '',
    onlyOffers ? '1' : '0',
    onlyBestsellers ? '1' : '0',
    priceMin ?? '',
    priceMax ?? '',
  ].join('|')

  const [items, setItems] = useState<ProductCard[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const requestId = useRef(0)

  useEffect(() => {
    let cancelled = false
    void fetchCatalogPriceCeiling()
      .then((ceiling) => {
        if (!cancelled) setPriceCeiling(ceiling)
      })
      .catch(() => {
        /* fallback local ya esta en state */
      })
    return () => {
      cancelled = true
    }
  }, [])

  const loadPage = useCallback(
    async (nextPage: number, append: boolean) => {
      const id = ++requestId.current
      if (append) setLoadingMore(true)
      else {
        setLoading(true)
        setError(null)
      }

      try {
        const result = await fetchCatalogPage({
          search,
          categoryIds,
          availability,
          onlyOffers,
          onlyBestsellers,
          priceMin,
          priceMax,
          page: nextPage,
          pageSize: PAGE_SIZE,
        })
        if (id !== requestId.current) return

        setItems((current) =>
          append ? [...current, ...result.items] : result.items,
        )
        setPage(result.page)
        setTotal(result.total)
        setTotalPages(result.totalPages)
      } catch (cause) {
        if (id !== requestId.current) return
        setError(
          cause instanceof Error ? cause : new Error('No se pudo cargar el catálogo'),
        )
        if (!append) setItems([])
      } finally {
        if (id === requestId.current) {
          setLoading(false)
          setLoadingMore(false)
        }
      }
    },
    [
      search,
      categoryIds,
      availability,
      onlyOffers,
      onlyBestsellers,
      priceMin,
      priceMax,
    ],
  )

  useEffect(() => {
    void loadPage(1, false)
  }, [filterKey, loadPage])

  const update = useCallback(
    (changes: Record<string, string | null>) => {
      const next = new URLSearchParams(params)
      for (const [key, value] of Object.entries(changes)) {
        if (value === null || value === '') next.delete(key)
        else next.set(key, value)
      }
      next.delete('page')
      setParams(next, { replace: true })
    },
    [params, setParams],
  )

  if (error && items.length === 0) {
    return <ErrorState error={error} onRetry={() => void loadPage(1, false)} />
  }

  const hasMore = page < totalPages
  const shown = items.length

  return (
    <div>
      <div className="mb-5">
        <SearchBar key={search} id="buscador-catalogo" initialValue={search} />
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Filters
          priceCeiling={priceCeiling}
          value={{ availability, priceMin, priceMax }}
          onChange={(next) =>
            update({
              disp: next.availability,
              pmin: next.priceMin != null ? String(next.priceMin) : null,
              pmax: next.priceMax != null ? String(next.priceMax) : null,
            })
          }
        />

        <button
          type="button"
          onClick={() => update({ oferta: onlyOffers ? null : '1' })}
          aria-pressed={onlyOffers}
          className={`rounded-full border-2 px-3 py-2 text-sm font-semibold transition-colors ${
            onlyOffers
              ? 'border-brand-600 bg-brand-50 text-brand-800'
              : 'border-ink-200 bg-white text-ink-800 hover:border-ink-300'
          }`}
        >
          Solo ofertas
        </button>

        <button
          type="button"
          onClick={() =>
            update({ 'mas-vendidos': onlyBestsellers ? null : '1' })
          }
          aria-pressed={onlyBestsellers}
          className={`rounded-full border-2 px-3 py-2 text-sm font-semibold transition-colors ${
            onlyBestsellers
              ? 'border-brand-600 bg-brand-50 text-brand-800'
              : 'border-ink-200 bg-white text-ink-800 hover:border-ink-300'
          }`}
        >
          Solo más vendidos
        </button>

        {search ? (
          <p className="text-ink-600 text-sm">
            Resultados para{' '}
            <span className="text-ink-900 font-semibold">“{search}”</span>
          </p>
        ) : null}

        {!loading ? (
          <p className="text-ink-500 ml-auto text-sm" aria-live="polite">
            {total === 0
              ? 'Sin resultados'
              : shown < total
                ? `${shown} de ${total} productos`
                : `${total} ${total === 1 ? 'producto' : 'productos'}`}
          </p>
        ) : null}
      </div>

      {loading ? (
        <ProductGrid products={[]} loading skeletonCount={PAGE_SIZE / 2} />
      ) : items.length === 0 ? (
        <EmptyState
          title="No encontramos ese producto"
          description={
            search
              ? 'Prueba combinando nombre, medida o color (amoladora 9 pulgadas, spray blanco) o el código. Si no aparece, escríbenos y lo buscamos por ti.'
              : 'Todavía no hay productos publicados en esta sección.'
          }
          action={
            <ButtonLink to="/catalogo" variant="outline">
              Ver todo el catálogo
            </ButtonLink>
          }
        />
      ) : (
        <>
          <ProductGrid products={items} />

          {hasMore ? (
            <div className="mt-10 flex flex-col items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="min-h-12 min-w-[12rem]"
                disabled={loadingMore}
                onClick={() => void loadPage(page + 1, true)}
              >
                {loadingMore ? 'Cargando…' : 'Cargar más'}
              </Button>
              {loadingMore ? <Spinner label="Cargando más productos" /> : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
