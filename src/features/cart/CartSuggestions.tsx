import { Link } from 'react-router-dom'
import { InfiniteMarquee } from '@/animation/InfiniteMarquee'
import { ProductCard } from '@/features/catalog/ProductCard'
import { ProductImage } from '@/components/ProductImage'
import { fetchCartSuggestions } from '@/data/products'
import { fetchActivePromotions } from '@/data/promotions'
import { useAsync } from '@/lib/useAsync'
import { remainingDaysLabel, daysUntilDate } from '@/lib/format'
import type { Promotion } from '@/lib/domain'

/**
 * Bloque inferior del carrito: sugerencias + promociones vigentes.
 * Reutiliza InfiniteMarquee (misma lógica GSAP que Sobre Nosotros).
 */
export function CartSuggestions() {
  const suggestions = useAsync(() => fetchCartSuggestions(16), [])
  const promotions = useAsync(fetchActivePromotions, [])

  const products = suggestions.data ?? []
  const activePromos = promotions.data ?? []

  if (products.length === 0 && activePromos.length === 0) return null

  return (
    <div className="mt-12 space-y-10 border-t border-ink-100 pt-10">
      {products.length > 0 ? (
        <section aria-labelledby="cart-sugerencias">
          <h2
            id="cart-sugerencias"
            className="text-ink-900 text-lg font-extrabold tracking-tight sm:text-xl"
          >
            También te puede interesar
          </h2>
          <p className="text-ink-600 mt-1 text-sm">
            Ofertas y más vendidos. Si tiene una sola opción, puedes agregarlo
            directo.
          </p>

          <InfiniteMarquee
            className="mt-4"
            items={products}
            getKey={(product) => product.id}
            ariaLabel="Productos sugeridos"
            secondsPerItem={5}
            minDuration={18}
            listClassName="flex gap-3 pr-3"
            renderItem={(product, { clone }) => (
              <div className="w-40 shrink-0 sm:w-44">
                <ProductCard
                  product={product}
                  compact
                  eager={!clone}
                  interactive={!clone}
                />
              </div>
            )}
          />
        </section>
      ) : null}

      {activePromos.length > 0 ? (
        <section aria-labelledby="cart-promociones">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2
                id="cart-promociones"
                className="text-ink-900 text-lg font-extrabold tracking-tight sm:text-xl"
              >
                Promociones activas
              </h2>
              <p className="text-ink-600 mt-1 text-sm">
                Toca una para ver el detalle y solicitar el combo.
              </p>
            </div>
            <Link
              to="/promociones"
              className="text-brand-700 text-sm font-semibold underline decoration-dotted"
            >
              Ver todas
            </Link>
          </div>

          <InfiniteMarquee
            items={activePromos}
            getKey={(promo) => promo.id}
            ariaLabel="Promociones activas"
            secondsPerItem={6}
            minDuration={18}
            listClassName="flex gap-3 pr-3"
            renderItem={(promo, { clone }) => (
              <PromoTile promotion={promo} clone={clone} />
            )}
          />
        </section>
      ) : null}
    </div>
  )
}

function PromoTile({
  promotion,
  clone,
}: {
  promotion: Promotion
  clone: boolean
}) {
  const days = daysUntilDate(promotion.endDate)

  return (
    <Link
      to="/promociones"
      tabIndex={clone ? -1 : 0}
      aria-label={clone ? undefined : `Ver promoción: ${promotion.title}`}
      className="border-ink-100 rounded-card block w-52 shrink-0 overflow-hidden border bg-white sm:w-60"
    >
      <div className="bg-ink-50 relative aspect-[16/10] overflow-hidden">
        <ProductImage
          url={promotion.imageUrl}
          alt=""
          eager={!clone}
          sizes="15rem"
          className="size-full object-cover"
        />
        <span className="bg-brand-700 absolute left-2 top-2 rounded-full px-2 py-0.5 text-[0.65rem] font-bold text-white">
          {remainingDaysLabel(days)}
        </span>
      </div>
      <div className="p-3">
        <p className="text-ink-900 line-clamp-2 text-xs font-semibold leading-snug">
          {promotion.title}
        </p>
        {promotion.priceLabel ? (
          <p className="text-ink-800 mt-1 text-sm font-bold">
            {promotion.priceLabel}
          </p>
        ) : null}
      </div>
    </Link>
  )
}
