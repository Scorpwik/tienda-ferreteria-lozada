import { ProductCard } from './ProductCard'
import { ProductCardSkeleton } from '@/components/States'
import type { ProductCard as ProductCardData } from '@/lib/domain'

/** En celular siempre 2. Desde ahí, caben las que entren y el resto baja. */
const productGridClass =
  'grid min-w-0 grid-cols-2 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(14rem,1fr))]'

export function ProductGrid({
  products,
  loading = false,
  skeletonCount = 8,
}: {
  products: ProductCardData[]
  loading?: boolean
  skeletonCount?: number
}) {
  if (loading) {
    return (
      <div className={productGridClass}>
        {Array.from({ length: skeletonCount }, (_, index) => (
          <ProductCardSkeleton key={index} />
        ))}
      </div>
    )
  }

  return (
    <div className={productGridClass}>
      {products.map((product, index) => (
        <ProductCard
          key={product.id}
          product={product}
          // Las primeras cuatro entran en el viewport inicial: cargarlas
          // perezosas empeoraria el LCP.
          eager={index < 4}
        />
      ))}
    </div>
  )
}
