import { useEffect, useId, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SearchIcon } from './SearchBar'
import {
  SuggestionDismissLayer,
  scrollOptionIntoView,
  suggestionListClass,
  useDismissOnOutsidePointer,
  useNestedScroll,
} from './suggestionPanel'
import { categoryPath } from '@/lib/routes'
import type { CategoryNode } from '@/lib/domain'

type Hit = {
  id: string
  name: string
  hint: string | null
  to: string
}

type Props = {
  tree: CategoryNode[]
}

function fold(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function flatten(tree: CategoryNode[]): Hit[] {
  const hits: Hit[] = [
    { id: 'all', name: 'Todo', hint: 'Catálogo completo', to: '/catalogo' },
  ]

  for (const node of tree) {
    hits.push({
      id: node.id,
      name: node.name,
      hint: null,
      to: categoryPath(node.slug),
    })
    for (const child of node.children) {
      hits.push({
        id: child.id,
        name: child.name,
        hint: node.name,
        to: categoryPath(node.slug, child.slug),
      })
    }
  }

  return hits
}

/**
 * Buscador corto del arbol de categorias. Filtra en el cliente: el arbol
 * ya esta cargado y no hace falta otra consulta.
 */
export function CategorySearch({ tree }: Props) {
  const [value, setValue] = useState('')
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const navigate = useNavigate()
  const listId = useId()
  const inputId = useId()

  const hits = useMemo(() => flatten(tree), [tree])
  const query = fold(value)
  const matches = useMemo(() => {
    if (!query) return []
    return hits.filter((hit) => fold(`${hit.name} ${hit.hint ?? ''}`).includes(query))
  }, [hits, query])

  const showList = open && query.length > 0
  const rootRef = useDismissOnOutsidePointer<HTMLDivElement>(showList, () =>
    setOpen(false),
  )
  const listRef = useNestedScroll(showList && matches.length > 0)

  useEffect(() => {
    if (highlight < 0) return
    scrollOptionIntoView(listRef.current, `${listId}-opt-${highlight}`)
  }, [highlight, listId, listRef, matches])

  const pick = (hit: Hit) => {
    setOpen(false)
    setValue('')
    setHighlight(-1)
    navigate(hit.to)
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setOpen(false)
      return
    }
    if (!showList || matches.length === 0) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlight((current) => Math.min(current + 1, matches.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlight((current) => Math.max(current - 1, -1))
    } else if (event.key === 'Enter' && highlight >= 0 && matches[highlight]) {
      event.preventDefault()
      pick(matches[highlight])
    }
  }

  return (
    <div ref={rootRef} className={showList ? 'relative z-30' : 'relative'}>
      {showList ? <SuggestionDismissLayer onDismiss={() => setOpen(false)} /> : null}

      <form
        role="search"
        className="relative z-20"
        onSubmit={(event) => {
          event.preventDefault()
          const hit = matches[highlight >= 0 ? highlight : 0]
          if (hit) pick(hit)
        }}
      >
        <label htmlFor={inputId} className="sr-only">
          Buscar categoría
        </label>
        <SearchIcon className="text-ink-400 pointer-events-none absolute left-2.5 top-1/2 z-10 size-4 -translate-y-1/2" />
        <input
          id={inputId}
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          spellCheck={false}
          value={value}
          placeholder="Buscar categoría"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={showList ? listId : undefined}
          aria-activedescendant={
            highlight >= 0 ? `${listId}-opt-${highlight}` : undefined
          }
          onChange={(event) => {
            const next = event.target.value
            setValue(next)
            setHighlight(-1)
            setOpen(next.trim().length > 0)
          }}
          onFocus={() => {
            if (value.trim()) setOpen(true)
          }}
          onKeyDown={onKeyDown}
          onBlur={(event) => {
            const next = event.relatedTarget
            if (!(next instanceof Node) || rootRef.current?.contains(next)) return
            setOpen(false)
          }}
          className="border-ink-200 placeholder:text-ink-400 focus:border-brand-600 w-full rounded-lg border-2 bg-white py-2 pl-8 pr-3 text-sm focus:outline-none"
        />

        {showList && matches.length > 0 ? (
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label="Sugerencias de categorías"
            data-lenis-prevent=""
            className={suggestionListClass('max-h-64')}
          >
            {matches.map((hit, index) => {
              const active = index === highlight
              return (
                <li key={hit.id} role="presentation">
                  <button
                    id={`${listId}-opt-${index}`}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => pick(hit)}
                    onMouseEnter={() => setHighlight(index)}
                    className={`flex w-full flex-col px-3 py-2 text-left ${
                      active ? 'bg-brand-50' : 'hover:bg-ink-50'
                    }`}
                  >
                    <span className="text-ink-900 text-sm font-semibold">{hit.name}</span>
                    {hit.hint ? (
                      <span className="text-ink-500 text-xs">{hit.hint}</span>
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
        ) : null}

        {showList && matches.length === 0 ? (
          <p className="border-ink-100 text-ink-500 absolute z-20 mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm shadow-lg">
            Ninguna categoría coincide
          </p>
        ) : null}
      </form>
    </div>
  )
}
