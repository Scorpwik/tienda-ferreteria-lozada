import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AvailabilityBadge } from '@/components/AvailabilityBadge'
import { ProductImage } from '@/components/ProductImage'
import { useCart } from '@/features/cart/CartProvider'
import { catalogAvailabilityBadge } from '@/lib/domain'
import { formatPrice } from '@/lib/format'
import { productPath } from '@/lib/routes'
import type { ProductCard as ProductCardData } from '@/lib/domain'

/** Precio de la tarjeta: "Desde $X" solo si las variantes no cuestan igual. */
function PriceLabel({ product }: { product: ProductCardData }) {
  if (product.availability === 'consultar' || product.priceFrom === null) {
    return (
      <span className="text-amber-brand-dark text-sm font-bold">
        Consultar precio
      </span>
    )
  }

  const hasRange =
    product.priceTo !== null && product.priceTo > product.priceFrom

  return (
    <span className="text-ink-900 font-bold">
      {hasRange ? (
        <>
          <span className="text-ink-500 text-xs font-semibold">Desde </span>
          {formatPrice(product.priceFrom)}
        </>
      ) : (
        formatPrice(product.priceFrom)
      )}
    </span>
  )
}

export function ProductCard({
  product,
  eager = false,
  /** En carruseles estrechos, el botón Agregar sigue disponible. */
  compact = false,
  /** En copias del carrusel se saca del tab, pero el clic sigue activo. */
  interactive = true,
}: {
  product: ProductCardData
  eager?: boolean
  compact?: boolean
  interactive?: boolean
}) {
  const { add } = useCart()
  const [added, setAdded] = useState(false)
  const badge = catalogAvailabilityBadge(product.variants)
  const canQuickAdd = Boolean(product.quickAdd)

  const handleQuickAdd = () => {
    const quick = product.quickAdd
    if (!quick) return
    add({
      variantId: quick.variantId,
      productId: product.id,
      productOriginId: product.origin_id,
      productName: product.name,
      variantLabel: quick.variantLabel,
      saleUnit: quick.saleUnit,
      unitPrice: quick.unitPrice,
      quantity: 1,
      imageUrl: product.imageUrl,
    })
    setAdded(true)
    window.setTimeout(() => setAdded(false), 1600)
  }

  return (
    <article
      data-reveal={compact ? undefined : ''}
      className="card-hover-desktop border-ink-100 rounded-card group focus-within:ring-brand-600 relative flex flex-col overflow-hidden border bg-white will-change-transform focus-within:ring-2"
    >
      <div className="bg-ink-50 relative aspect-square overflow-hidden">
        <ProductImage
          url={product.imageUrl}
          alt={product.name}
          eager={eager}
          className="size-full lg:transition-transform lg:duration-500 lg:group-hover:scale-105"
        />

        {product.isOffer ? (
          <span className="bg-brand-700 absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-white">
            Oferta
          </span>
        ) : null}
      </div>

      <div className={`flex flex-1 flex-col gap-2 ${compact ? 'p-3' : 'p-4'}`}>
        {product.categoryName ? (
          <p className="text-ink-500 text-xs font-semibold uppercase tracking-wide">
            {product.categoryName}
          </p>
        ) : null}

        <h3 className="text-ink-900 text-sm font-semibold leading-snug">
          {/* El enlace cubre la tarjeta entera; el botón Agregar va encima (z-10). */}
          <Link
            to={productPath(product)}
            tabIndex={interactive ? undefined : -1}
            className="after:absolute after:inset-0"
          >
            {product.name}
          </Link>
        </h3>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
          <PriceLabel product={product} />
          {badge ? (
            <AvailabilityBadge
              availability={badge.availability}
              label={badge.label}
            />
          ) : null}
        </div>

        {product.variantCount > 1 ? (
          <p className="text-ink-500 text-xs">
            {product.variantCount} opciones disponibles
          </p>
        ) : null}

        {canQuickAdd ? (
          <button
            type="button"
            tabIndex={interactive ? undefined : -1}
            onClick={handleQuickAdd}
            className={`relative z-10 mt-1 min-h-10 w-full rounded-lg text-sm font-bold transition-colors ${
              added
                ? 'bg-emerald-700 text-white'
                : 'bg-brand-700 hover:bg-brand-800 active:bg-brand-900 text-white'
            }`}
          >
            {added ? 'Añadido' : 'Agregar'}
          </button>
        ) : null}
      </div>
    </article>
  )
}
