import { useSearchParams } from 'react-router-dom'
import { CatalogBrowser } from '@/features/catalog/CatalogBrowser'
import { CategoryNav } from '@/features/catalog/CategoryNav'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { fetchCategoryTree } from '@/data/categories'
import { useAsync } from '@/lib/useAsync'
import { useDocumentMeta } from '@/lib/useDocumentMeta'

export function CatalogPage() {
  const [params] = useSearchParams()
  const search = params.get('q') ?? ''
  const { data: tree } = useAsync(fetchCategoryTree, [])

  useDocumentMeta({
    title: search
      ? `${search} | Catálogo Ferretería Lozada`
      : 'Catálogo | Ferretería Lozada',
    description:
      'Busca herramientas, fijaciones y materiales de construcción por nombre, código o medida. Cotiza por WhatsApp.',
    // Las paginas de busqueda no aportan a SEO y generan URLs infinitas.
    noIndex: Boolean(search),
  })

  return (
    <div className="container-wide py-8">
      <Breadcrumbs items={[{ label: 'Inicio', to: '/' }, { label: 'Catálogo' }]} />

      <h1 className="text-ink-900 text-2xl font-extrabold tracking-tight sm:text-3xl">
        {search ? 'Resultados de búsqueda' : 'Catálogo completo'}
      </h1>
      <p className="text-ink-600 mt-2 max-w-2xl text-sm">
        Si no encuentras algo o no sabes qué medida necesitas, escríbenos por
        WhatsApp y te ayudamos a elegir.
      </p>

      <div className="mt-8 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-8">
        <aside className="mb-6 lg:mb-0">
          <CategoryNav tree={tree ?? []} />
        </aside>

        <CatalogBrowser />
      </div>
    </div>
  )
}
