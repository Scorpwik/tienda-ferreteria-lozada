import { useParams } from 'react-router-dom'
import { CatalogBrowser } from '@/features/catalog/CatalogBrowser'
import { CategoryNav } from '@/features/catalog/CategoryNav'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { ErrorState, Skeleton } from '@/components/States'
import { NotFoundPage } from './NotFound'
import {
  categoryBranchIds,
  fetchCategories,
  resolveCategoryPath,
} from '@/data/categories'
import { buildCategoryTree } from '@/lib/domain'
import { useAsync } from '@/lib/useAsync'
import { useDocumentMeta } from '@/lib/useDocumentMeta'
import { categoryPath } from '@/lib/routes'

export function CategoryPage() {
  const { parentSlug, childSlug } = useParams()

  const resolved = useAsync(
    async () => {
      if (!parentSlug) return null
      const [path, categories] = await Promise.all([
        resolveCategoryPath(parentSlug, childSlug),
        fetchCategories(),
      ])
      return { path, categories }
    },
    [parentSlug, childSlug],
  )

  const active = resolved.data?.path
  const current = active?.child ?? active?.parent ?? null

  useDocumentMeta({
    title: current
      ? `${current.name} | Ferretería Lozada`
      : 'Catálogo | Ferretería Lozada',
    description: current
      ? `${current.name} en Ferretería Lozada, Chillogallo. Consulta medidas, precios y disponibilidad, y cotiza por WhatsApp.`
      : undefined,
  })

  if (resolved.error) {
    return (
      <div className="container-wide py-10">
        <ErrorState error={resolved.error} onRetry={resolved.reload} />
      </div>
    )
  }

  if (resolved.loading) {
    return (
      <div className="container-wide py-10">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="mt-4 h-9 w-72" />
        <Skeleton className="mt-8 h-64 w-full" />
      </div>
    )
  }

  if (!active || !current) return <NotFoundPage />

  const categories = resolved.data?.categories ?? []
  const branchIds = categoryBranchIds(categories, current.id)
  const tree = buildCategoryTree(categories)

  return (
    <div className="container-wide py-8">
      <Breadcrumbs
        items={[
          { label: 'Inicio', to: '/' },
          { label: 'Catálogo', to: '/catalogo' },
          { label: active.parent.name, to: categoryPath(active.parent.slug) },
          ...(active.child ? [{ label: active.child.name }] : []),
        ]}
      />

      <h1 className="text-ink-900 text-2xl font-extrabold tracking-tight sm:text-3xl">
        {current.name}
      </h1>

      <div className="mt-8 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-8">
        <aside className="mb-6 lg:mb-0">
          <CategoryNav tree={tree} activeSlug={current.slug} />
        </aside>

        <CatalogBrowser categoryIds={branchIds} />
      </div>
    </div>
  )
}
