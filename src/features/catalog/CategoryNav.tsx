import { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { CategorySearch } from './CategorySearch'
import { BottomSheet } from '@/components/BottomSheet'
import { categoryPath } from '@/lib/routes'
import type { CategoryNode } from '@/lib/domain'

const allLinkClass = (isActive: boolean) =>
  isActive
    ? 'bg-brand-50 text-brand-700 block rounded-lg px-3 py-2 text-sm font-semibold'
    : 'text-ink-700 hover:bg-ink-50 block rounded-lg px-3 py-2 text-sm font-semibold'

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`size-4 shrink-0 opacity-80 transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
      aria-hidden="true"
    >
      <path d="M7 4.5 13 10 7 15.5" />
    </svg>
  )
}

/** Botón aparte de la fila de categoría: expandir subcategorías (móvil y sidebar). */
function CategoryExpandButton({
  open,
  label,
  panelId,
  onToggle,
}: {
  open: boolean
  label: string
  panelId: string
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      className="text-ink-400 bg-ink-50/40 grid size-11 min-h-11 min-w-11 shrink-0 place-items-center rounded-lg border border-ink-100/60 shadow-none transition-[colors,transform,box-shadow] hover:border-ink-100 hover:bg-ink-50/80 hover:text-ink-500 hover:shadow-sm hover:shadow-ink-900/5 active:scale-[0.98] active:bg-ink-100/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-2 aria-expanded:border-brand-200/50 aria-expanded:bg-brand-50/40 aria-expanded:text-brand-600 aria-expanded:shadow-sm aria-expanded:shadow-brand-900/5"
      aria-expanded={open}
      aria-controls={panelId}
      aria-label={open ? `Ocultar subcategorías de ${label}` : `Ver subcategorías de ${label}`}
      onClick={onToggle}
    >
      <Chevron open={open} />
    </button>
  )
}

function ChevronDown() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-ink-500 size-5 shrink-0"
      aria-hidden="true"
    >
      <path d="M5 7.5 10 12.5 15 7.5" />
    </svg>
  )
}

function parentIsActive(node: CategoryNode, pathname: string) {
  const parentPath = categoryPath(node.slug)
  return pathname === parentPath || pathname.startsWith(`${parentPath}/`)
}

function resolveSelectionLabel(
  pathname: string,
  tree: CategoryNode[],
  activeSlug?: string,
): string {
  if (pathname === '/catalogo') return 'Todo el catálogo'

  for (const node of tree) {
    const parentPath = categoryPath(node.slug)
    if (pathname === parentPath) return node.name
    for (const child of node.children) {
      const childPath = categoryPath(node.slug, child.slug)
      if (pathname === childPath || activeSlug === child.slug) {
        return child.name
      }
    }
    if (parentIsActive(node, pathname) && node.children.length === 0) {
      return node.name
    }
  }

  return 'Elegir categoría'
}

function CategoryTreeList({
  tree,
  openIds,
  toggle,
  onPick,
}: {
  tree: CategoryNode[]
  openIds: Set<string>
  toggle: (id: string) => void
  onPick?: () => void
}) {
  const { pathname } = useLocation()
  const allActive = pathname === '/catalogo'

  return (
    <ul className="space-y-0.5">
      <li>
        <NavLink
          to="/catalogo"
          end
          className={() => allLinkClass(allActive)}
          onClick={onPick}
        >
          Todo
        </NavLink>
      </li>
      {tree.map((node) => {
        const hasChildren = node.children.length > 0
        const open = hasChildren && openIds.has(node.id)
        const panelId = `cat-children-${node.id}`

        return (
          <li key={node.id}>
            <div className="flex items-stretch gap-2">
              <NavLink
                to={categoryPath(node.slug)}
                onClick={onPick}
                className={({ isActive }) =>
                  `min-w-0 flex-1 rounded-lg px-3 py-2.5 text-sm font-semibold ${
                    isActive
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-ink-700 hover:bg-ink-50'
                  }`
                }
              >
                {node.name}
              </NavLink>
              {hasChildren ? (
                <CategoryExpandButton
                  open={open}
                  label={node.name}
                  panelId={panelId}
                  onToggle={() => toggle(node.id)}
                />
              ) : null}
            </div>

            {hasChildren && open ? (
              <ul
                id={panelId}
                className="border-ink-100 ml-3 mt-1 space-y-0.5 border-l pl-3"
              >
                {node.children.map((child) => (
                  <li key={child.id}>
                    <NavLink
                      to={categoryPath(node.slug, child.slug)}
                      onClick={onPick}
                      className={({ isActive }) =>
                        `block rounded-lg px-3 py-2 text-sm ${
                          isActive
                            ? 'text-brand-700 font-semibold'
                            : 'text-ink-600 hover:text-ink-900'
                        }`
                      }
                    >
                      {child.name}
                    </NavLink>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Arbol de categorias colapsado. En escritorio: sidebar. En móvil: un botón
 * que abre panel inferior con el mismo arbol (sin fila de pastillas).
 */
export function CategoryNav({
  tree,
  activeSlug,
}: {
  tree: CategoryNode[]
  activeSlug?: string
}) {
  const { pathname } = useLocation()
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set())
  const [sheetOpen, setSheetOpen] = useState(false)

  useEffect(() => {
    const activeParent = tree.find((node) => parentIsActive(node, pathname))
    if (!activeParent) return
    setOpenIds((prev) => {
      if (prev.has(activeParent.id)) return prev
      const next = new Set(prev)
      next.add(activeParent.id)
      return next
    })
  }, [pathname, tree])

  useEffect(() => {
    setSheetOpen(false)
  }, [pathname])

  const toggle = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectionLabel = useMemo(
    () => resolveSelectionLabel(pathname, tree, activeSlug),
    [pathname, tree, activeSlug],
  )

  if (tree.length === 0) return null

  return (
    <>
      <nav aria-label="Categorías" className="hidden lg:block">
        <h2 className="text-ink-900 mb-2 text-sm font-bold uppercase tracking-wide">
          Categorías
        </h2>
        <CategorySearch tree={tree} />
        <div className="mt-3">
          <CategoryTreeList tree={tree} openIds={openIds} toggle={toggle} />
        </div>
      </nav>

      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="border-ink-200 text-ink-900 hover:border-brand-600 flex w-full min-h-12 items-center justify-between gap-3 rounded-xl border-2 bg-white px-4 py-3 text-left shadow-sm"
          aria-haspopup="dialog"
          aria-expanded={sheetOpen}
        >
          <span className="min-w-0">
            <span className="text-ink-500 block text-xs font-bold uppercase tracking-wide">
              Categoría
            </span>
            <span className="text-ink-900 block truncate text-sm font-extrabold">
              {selectionLabel}
            </span>
          </span>
          <ChevronDown />
        </button>

        <BottomSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title="Categorías"
          description="Elige una familia o subcategoría. El catálogo se actualiza al seleccionar."
          closeLabel="Cerrar categorías"
        >
          <CategorySearch tree={tree} />
          <div className="mt-4">
            <CategoryTreeList
              tree={tree}
              openIds={openIds}
              toggle={toggle}
              onPick={() => setSheetOpen(false)}
            />
          </div>
        </BottomSheet>
      </div>
    </>
  )
}