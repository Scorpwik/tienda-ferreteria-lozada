import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { CategorySearch } from './CategorySearch'
import { categoryPath } from '@/lib/routes'
import type { CategoryNode } from '@/lib/domain'

const allLinkClass = (isActive: boolean) =>
  isActive
    ? 'bg-brand-50 text-brand-700 block rounded-lg px-3 py-2 text-sm font-semibold'
    : 'text-ink-700 hover:bg-ink-50 block rounded-lg px-3 py-2 text-sm font-semibold'

const allChipClass = (isActive: boolean) =>
  isActive
    ? 'bg-brand-700 inline-flex whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold text-white'
    : 'border-ink-200 text-ink-700 inline-flex whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold'

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`size-4 shrink-0 transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
      aria-hidden="true"
    >
      <path d="M7 4.5 13 10 7 15.5" />
    </svg>
  )
}

function parentIsActive(node: CategoryNode, pathname: string) {
  const parentPath = categoryPath(node.slug)
  return pathname === parentPath || pathname.startsWith(`${parentPath}/`)
}

/**
 * Arbol de categorias colapsado. El cliente abre solo la rama que le interesa.
 * En movil se muestran chips de categorias padre (sin volcar todas las hijas).
 */
export function CategoryNav({
  tree,
  activeSlug,
}: {
  tree: CategoryNode[]
  activeSlug?: string
}) {
  const { pathname } = useLocation()
  const allActive = pathname === '/catalogo'
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set())

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

  const toggle = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (tree.length === 0) return null

  const activeParent = tree.find((node) => parentIsActive(node, pathname))

  return (
    <>
      <nav aria-label="Categorías" className="hidden lg:block">
        <h2 className="text-ink-900 mb-2 text-sm font-bold uppercase tracking-wide">
          Categorías
        </h2>
        <CategorySearch tree={tree} />
        <ul className="mt-3 space-y-0.5">
          <li>
            <NavLink to="/catalogo" end className={() => allLinkClass(allActive)}>
              Todo
            </NavLink>
          </li>
          {tree.map((node) => {
            const hasChildren = node.children.length > 0
            const open = hasChildren && openIds.has(node.id)
            const panelId = `cat-children-${node.id}`

            return (
              <li key={node.id}>
                <div className="flex items-stretch gap-0.5">
                  <NavLink
                    to={categoryPath(node.slug)}
                    className={({ isActive }) =>
                      `min-w-0 flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${
                        isActive
                          ? 'bg-brand-50 text-brand-700'
                          : 'text-ink-700 hover:bg-ink-50'
                      }`
                    }
                  >
                    {node.name}
                  </NavLink>
                  {hasChildren ? (
                    <button
                      type="button"
                      className="text-ink-500 hover:bg-ink-50 hover:text-ink-800 grid size-9 shrink-0 place-items-center rounded-lg"
                      aria-expanded={open}
                      aria-controls={panelId}
                      aria-label={
                        open
                          ? `Ocultar subcategorías de ${node.name}`
                          : `Ver subcategorías de ${node.name}`
                      }
                      onClick={() => toggle(node.id)}
                    >
                      <Chevron open={open} />
                    </button>
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
                          className={({ isActive }) =>
                            `block rounded-lg px-3 py-1.5 text-sm ${
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
      </nav>

      <div className="lg:hidden">
        <h2 className="text-ink-900 mb-2 text-sm font-bold uppercase tracking-wide">
          Categorías
        </h2>
        <CategorySearch tree={tree} />
        <ul className="-mx-4 mt-3 flex snap-x gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <li className="snap-start">
            <NavLink to="/catalogo" end className={allChipClass(allActive)}>
              Todo
            </NavLink>
          </li>
          {tree.map((node) => (
            <li key={node.id} className="snap-start">
              <NavLink
                to={categoryPath(node.slug)}
                className={
                  activeSlug === node.slug || activeParent?.id === node.id
                    ? 'bg-brand-700 inline-flex whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold text-white'
                    : 'border-ink-200 text-ink-700 inline-flex whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold'
                }
              >
                {node.name}
              </NavLink>
            </li>
          ))}
        </ul>
        {activeParent && activeParent.children.length > 0 ? (
          <ul className="-mx-4 mt-2 flex snap-x gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {activeParent.children.map((child) => (
              <li key={child.id} className="snap-start">
                <NavLink
                  to={categoryPath(activeParent.slug, child.slug)}
                  className={
                    activeSlug === child.slug
                      ? 'bg-brand-50 text-brand-700 inline-flex whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold'
                      : 'text-ink-600 hover:text-ink-900 inline-flex whitespace-nowrap px-3 py-1.5 text-sm'
                  }
                >
                  {child.name}
                </NavLink>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </>
  )
}
