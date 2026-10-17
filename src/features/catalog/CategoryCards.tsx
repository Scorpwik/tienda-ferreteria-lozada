import { Link } from 'react-router-dom'
import { categoryPath } from '@/lib/routes'
import type { CategoryNode } from '@/lib/domain'

function childCountLabel(count: number) {
  if (count === 0) return 'Ver productos'
  if (count === 1) return '1 subcategoría'
  return `${count} subcategorías`
}

/**
 * Grilla compacta de categorias padre para el home.
 * Evita pintar el arbol completo, que se hacía interminable.
 */
export function CategoryCards({ tree }: { tree: CategoryNode[] }) {
  if (tree.length === 0) return null

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {tree.map((node) => (
        <li key={node.id}>
          <Link
            to={categoryPath(node.slug)}
            className="card-hover-desktop border-ink-100 rounded-card hover:border-brand-200 flex h-full flex-col justify-between border bg-white p-4 will-change-transform"
          >
            <span className="text-ink-900 text-sm font-bold leading-snug">
              {node.name}
            </span>
            <span className="text-ink-500 mt-2 text-xs">
              {childCountLabel(node.children.length)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
