import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchSearchSuggestions } from '@/data/products'
import { formatPrice } from '@/lib/format'
import { productPath } from '@/lib/routes'
import { searchQuerySchema } from '@/lib/validation'
import type { ProductCard } from '@/lib/domain'
import {
  SuggestionDismissLayer,
  scrollOptionIntoView,
  suggestionListClass,
  useDismissOnOutsidePointer,
  useNestedScroll,
} from './suggestionPanel'

type Props = {
  initialValue?: string
  size?: 'md' | 'lg'
  autoFocus?: boolean
  id?: string
}

/**
 * Buscador global. Navega a /catalogo?q=... para que el resultado sea una URL
 * compartible, en vez de guardar el termino en memoria.
 */
export function SearchBar({
  initialValue = '',
  size = 'md',
  autoFocus = false,
  id = 'buscador',
}: Props) {
  const [value, setValue] = useState(initialValue)
  const [suggestions, setSuggestions] = useState<ProductCard[]>([])
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const navigate = useNavigate()
  const listId = useId()
  const closedByUser = useRef(false)

  const closeSuggestions = () => {
    closedByUser.current = true
    setOpen(false)
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    goToCatalog(value)
  }

  const goToCatalog = (raw: string) => {
    const term = searchQuerySchema.parse(raw)
    closeSuggestions()
    navigate(term ? `/catalogo?q=${encodeURIComponent(term)}` : '/catalogo')
  }

  useEffect(() => {
    const term = value.trim()
    if (term.length < 2) {
      setSuggestions([])
      setOpen(false)
      return
    }

    closedByUser.current = false
    let cancelled = false
    const timer = window.setTimeout(() => {
      void fetchSearchSuggestions(term)
        .then((items) => {
          if (cancelled || closedByUser.current) return
          setSuggestions(items)
          setOpen(items.length > 0)
          setHighlight(-1)
        })
        .catch(() => {
          if (cancelled) return
          setSuggestions([])
          setOpen(false)
        })
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [value])

  const pick = (product: ProductCard) => {
    closeSuggestions()
    navigate(productPath(product))
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlight((current) =>
        Math.min(current + 1, suggestions.length - 1),
      )
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlight((current) => Math.max(current - 1, -1))
    } else if (event.key === 'Escape') {
      closeSuggestions()
    } else if (event.key === 'Enter' && highlight >= 0 && suggestions[highlight]) {
      event.preventDefault()
      pick(suggestions[highlight])
    }
  }

  const tall = size === 'lg'
  const showList = open && suggestions.length > 0
  const rootRef = useDismissOnOutsidePointer<HTMLFormElement>(
    showList,
    closeSuggestions,
  )
  const listRef = useNestedScroll(showList)

  useEffect(() => {
    if (!showList || highlight < 0) return
    scrollOptionIntoView(listRef.current, `${listId}-opt-${highlight}`)
  }, [showList, highlight, listId, listRef])

  return (
    <form
      ref={rootRef}
      role="search"
      onSubmit={submit}
      className={showList ? 'relative z-30 w-full' : 'relative w-full'}
    >
      {showList ? <SuggestionDismissLayer onDismiss={closeSuggestions} /> : null}
      <label htmlFor={id} className="sr-only">
        Buscar productos por nombre, medida, color o código
      </label>
      <div className="relative z-20">
        <SearchIcon
          className={`text-ink-400 pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 ${tall ? 'size-6' : 'size-5'}`}
        />
        <input
          id={id}
          name="q"
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          autoFocus={autoFocus}
          value={value}
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={showList ? listId : undefined}
          aria-activedescendant={
            highlight >= 0 ? `${listId}-opt-${highlight}` : undefined
          }
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => {
            closedByUser.current = false
            if (suggestions.length > 0) setOpen(true)
          }}
          onPointerDown={() => {
            closedByUser.current = false
            if (suggestions.length > 0) setOpen(true)
          }}
          onBlur={(event) => {
            const next = event.relatedTarget
            if (!(next instanceof Node) || rootRef.current?.contains(next)) return
            closeSuggestions()
          }}
          placeholder="Nombre, medida, color o código. Ej: amoladora 9 pulgadas"
          className={`border-ink-200 placeholder:text-ink-400 focus:border-brand-600 w-full rounded-xl border-2 bg-white pl-12 pr-28 font-medium shadow-sm transition-colors focus:outline-none ${
            tall ? 'py-4 text-base' : 'py-3 text-[0.9375rem]'
          }`}
        />
        <button
          type="submit"
          className={`bg-brand-700 hover:bg-brand-800 absolute right-1.5 top-1/2 z-10 -translate-y-1/2 rounded-lg font-semibold text-white ${
            tall ? 'px-5 py-2.5 text-sm' : 'px-4 py-2 text-sm'
          }`}
        >
          Buscar
        </button>

        {showList ? (
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label="Sugerencias de búsqueda"
            data-lenis-prevent=""
            className={suggestionListClass()}
          >
            {suggestions.map((product, index) => {
              const active = index === highlight
              const price =
                product.availability === 'consultar' || product.priceFrom === null
                  ? 'Consultar'
                  : formatPrice(product.priceFrom)

              return (
                <li key={product.id} role="presentation">
                  <button
                    id={`${listId}-opt-${index}`}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => pick(product)}
                    className={`flex w-full items-start justify-between gap-3 px-4 py-2.5 text-left ${
                      active ? 'bg-brand-50' : 'hover:bg-ink-50'
                    }`}
                  >
                    <span>
                      <span className="text-ink-900 block text-sm font-semibold">
                        {product.name}
                      </span>
                      {product.categoryName ? (
                        <span className="text-ink-500 text-xs">
                          {product.categoryName}
                        </span>
                      ) : null}
                    </span>
                    <span className="text-ink-700 shrink-0 text-sm font-bold">
                      {price}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        ) : null}
      </div>
    </form>
  )
}

export function SearchIcon({ className = 'size-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}
