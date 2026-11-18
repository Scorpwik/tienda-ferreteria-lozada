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
    <div className="container-wide py-5 sm:py-6 lg:py-8">
      <Breadcrumbs items={[{ label: 'Inicio', to: '/' }, { label: 'Catálogo' }]} />

      <h1 className="text-ink-900 text-xl font-extrabold tracking-tight sm:text-2xl lg:text-3xl">
        {search ? `Búsqueda: ${search}` : 'Catálogo'}
      </h1>
      <p className="text-ink-600 mt-1.5 hidden max-w-2xl text-sm sm:block">
        Si no encuentras algo o no sabes qué medida necesitas, escríbenos por
        WhatsApp y te ayudamos a elegir.
      </p>

      <div className="mt-4 flex flex-col gap-4 sm:mt-5 lg:mt-8 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-8">
        <aside className="shrink-0 lg:mb-0">
          <CategoryNav tree={tree ?? []} />
        </aside>

        <div className="min-w-0">
          <CatalogBrowser />
        </div>
      </div>
    </div>
  )
}
