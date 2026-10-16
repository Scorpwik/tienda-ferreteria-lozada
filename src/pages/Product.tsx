import { useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useParams } from 'react-router-dom'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { AvailabilityBadge } from '@/components/AvailabilityBadge'
import { ProductImage } from '@/components/ProductImage'
import { ErrorState, Skeleton } from '@/components/States'
import { VariantSelector } from '@/features/catalog/VariantSelector'
import { AddToCart } from '@/features/cart/AddToCart'
import { WhatsAppButton } from '@/features/whatsapp/WhatsAppButton'
import { productInquiryMessage } from '@/features/whatsapp/buildMessage'
import { NotFoundPage } from './NotFound'
import { fetchProductById, fetchProductByOriginId } from '@/data/products'
import { formatPrice, variantLabel } from '@/lib/format'
import { parseProductParam, categoryPath } from '@/lib/routes'
import { useAsync } from '@/lib/useAsync'
import {
  pickPrimaryImage,
  sortProductImages,
  type ProductDetail,
  type ProductImage as ProductImageRow,
  type Variant,
} from '@/lib/domain'

function productJsonLd(data: ProductDetail) {
  const available = data.variants.filter(
    (variant) => variant.availability === 'disponible' && variant.price > 0,
  )
  const prices = available.map((variant) => variant.price)
  const lowPrice = prices.length > 0 ? Math.min(...prices) : undefined
  const highPrice = prices.length > 0 ? Math.max(...prices) : undefined

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: data.name,
    description: data.metaDescription ?? data.description ?? undefined,
    brand: { '@type': 'Brand', name: 'Ferretería Lozada' },
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'USD',
      ...(lowPrice != null ? { lowPrice: String(lowPrice) } : {}),
      ...(highPrice != null ? { highPrice: String(highPrice) } : {}),
      offerCount: String(available.length),
      availability: 'https://schema.org/InStock',
    },
  }
}

export function ProductPage() {
  const { originId } = useParams()
  const parsed = parseProductParam(originId)
  const [selected, setSelected] = useState<Variant | null>(null)

  const { data, loading, error, reload } = useAsync(async () => {
    if (!parsed) return null
    return parsed.kind === 'origin'
      ? fetchProductByOriginId(parsed.originId)
      : fetchProductById(parsed.id)
  }, [originId])

  const pageTitle = data ? data.metaTitle || data.name : 'Producto'
  const pageDescription = data?.metaDescription ?? undefined
  const jsonLd = useMemo(() => (data ? productJsonLd(data) : null), [data])

  if (error) {
    return (
      <div className="container-page py-10">
        <ErrorState error={error} onRetry={reload} />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="container-page py-10 lg:grid lg:grid-cols-2 lg:gap-12">
        <Skeleton className="aspect-square w-full" />
        <div className="mt-6 space-y-4 lg:mt-0">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    )
  }

  if (!data) return <NotFoundPage />

  // Las imagenes de la variante elegida manda; si no tiene, la del producto.
  const variantImages = selected
    ? data.images.filter((image) => image.variant_id === selected.id)
    : []
  const gallery = sortProductImages(
    variantImages.length > 0
      ? variantImages
      : data.images.filter((image) => image.variant_id === null),
  )

  const showPrice =
    selected !== null &&
    selected.availability !== 'consultar' &&
    selected.price > 0

  return (
    <div className="container-page py-8 lg:pb-28">
      <Helmet>
        <title>{pageTitle}</title>
        {pageDescription ? (
          <meta name="description" content={pageDescription} />
        ) : null}
        <meta property="og:title" content={pageTitle} />
        {pageDescription ? (
          <meta property="og:description" content={pageDescription} />
        ) : null}
        <meta property="og:type" content="product" />
        {jsonLd ? (
          <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
        ) : null}
      </Helmet>

      <Breadcrumbs
        items={[
          { label: 'Inicio', to: '/' },
          { label: 'Catálogo', to: '/catalogo' },
          ...(data.parentCategory
            ? [
                {
                  label: data.parentCategory.name,
                  to: categoryPath(data.parentCategory.slug),
                },
              ]
            : []),
          ...(data.category
            ? [
                {
                  label: data.category.name,
                  to: categoryPath(
                    data.parentCategory?.slug ?? data.category.slug,
                    data.parentCategory ? data.category.slug : null,
                  ),
                },
              ]
            : []),
          { label: data.name },
        ]}
      />

      <div className="lg:grid lg:grid-cols-2 lg:gap-12">
        <ProductGallery
          productId={data.id}
          productName={data.name}
          gallery={gallery}
          fallbackUrl={pickPrimaryImage(data.images)}
          isOffer={data.isOffer}
          variantKey={selected?.id ?? 'product'}
        />

        <div className="mt-8 lg:mt-0">
          {data.category ? (
            <p className="text-ink-500 text-xs font-semibold uppercase tracking-wide">
              {data.category.name}
            </p>
          ) : null}

          <h1 className="text-ink-900 mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
            {data.name}
          </h1>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            {showPrice && selected ? (
              <p
                key={selected.id}
                className="price-swap text-ink-900 text-3xl font-extrabold"
              >
                {formatPrice(selected.price)}
                {selected.sale_unit ? (
                  <span className="text-ink-500 ml-2 text-sm font-semibold">
                    / {selected.sale_unit}
                  </span>
                ) : null}
              </p>
            ) : (
              <p className="text-amber-brand-dark text-xl font-bold">
                Consultar precio
              </p>
            )}
            {/* En 'consultar' el precio ya dice "Consultar precio": el badge
                repetiria el mismo texto. */}
            {selected && selected.availability !== 'consultar' ? (
              <AvailabilityBadge availability={selected.availability} />
            ) : null}
          </div>

          {data.description ? (
            <p className="text-ink-700 mt-5 whitespace-pre-line text-sm leading-relaxed">
              {data.description}
            </p>
          ) : null}

          <div className="mt-7">
            <VariantSelector
              variants={data.variants}
              selected={selected}
              onSelect={setSelected}
            />
          </div>

          {selected ? <AddToCart product={data} variant={selected} /> : null}

          {/* Agotado o sin precio publicado: no se puede pedir, pero si consultar. */}
          {selected && selected.availability !== 'disponible' ? (
            <div className="border-ink-200 rounded-card mt-7 border bg-ink-50 p-5">
              <p className="text-ink-900 font-semibold">
                {selected.availability === 'agotado'
                  ? 'Esta opción está agotada por ahora.'
                  : 'Esta opción no tiene precio publicado.'}
              </p>
              <p className="text-ink-600 mt-1 text-sm">
                Escríbenos y te decimos en cuánto llega o qué alternativa te
                sirve igual.
              </p>
              <WhatsAppButton
                message={productInquiryMessage(
                  data.name,
                  variantLabel(selected) || null,
                )}
                size="lg"
                className="mt-4 w-full sm:w-auto"
              >
                {selected.availability === 'agotado'
                  ? 'Consultar disponibilidad'
                  : 'Consultar precio'}
              </WhatsAppButton>
            </div>
          ) : null}

          {data.origin_id !== null ? (
            <p className="text-ink-400 mt-8 text-xs">
              Código de producto: {data.origin_id}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

/** Galería: clic en miniatura cambia la imagen grande. */
function ProductGallery({
  productId,
  productName,
  gallery,
  fallbackUrl,
  isOffer,
  variantKey,
}: {
  productId: string
  productName: string
  gallery: ProductImageRow[]
  fallbackUrl: string | null
  isOffer: boolean
  variantKey: string
}) {
  const [activeImageId, setActiveImageId] = useState<string | null>(null)

  useEffect(() => {
    setActiveImageId(null)
  }, [productId, variantKey])

  const active =
    gallery.find((image) => image.id === activeImageId) ?? gallery[0] ?? null
  const cover = active?.url ?? fallbackUrl
  const thumbs = gallery

  return (
    <div>
      <div className="bg-ink-50 rounded-card relative aspect-square overflow-hidden">
        <ProductImage
          key={active?.id ?? cover ?? 'empty'}
          url={cover}
          alt={productName}
          eager
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="size-full lg:transition-transform lg:duration-700 lg:hover:scale-105"
        />
        {isOffer ? (
          <span className="bg-brand-700 absolute left-4 top-4 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white">
            Oferta
          </span>
        ) : null}
      </div>

      {thumbs.length > 1 ? (
        <ul className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5">
          {thumbs.map((image, index) => {
            const isActive = (active?.id ?? thumbs[0]?.id) === image.id

            return (
              <li key={image.id}>
                <button
                  type="button"
                  onClick={() => setActiveImageId(image.id)}
                  aria-label={`Ver imagen ${index + 1} de ${productName}`}
                  aria-pressed={isActive}
                  className={
                    isActive
                      ? 'border-brand-600 ring-brand-600/30 bg-ink-50 aspect-square w-full overflow-hidden rounded-lg border-2 ring-2'
                      : 'border-ink-200 hover:border-brand-500 bg-ink-50 aspect-square w-full overflow-hidden rounded-lg border-2'
                  }
                >
                  <ProductImage
                    url={image.url}
                    alt=""
                    sizes="20vw"
                    className="size-full"
                  />
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
