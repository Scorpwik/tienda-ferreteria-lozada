import { ButtonLink } from '@/components/Button'
import { ProductCardSkeleton } from '@/components/States'
import { SearchBar } from '@/features/catalog/SearchBar'
import { ProductCard } from '@/features/catalog/ProductCard'
import { CategoryCards } from '@/features/catalog/CategoryCards'
import { InfiniteMarquee } from '@/animation/InfiniteMarquee'
import { HomePromotions } from '@/features/promotions/HomePromotions'
import { WhatsAppButton } from '@/features/whatsapp/WhatsAppButton'
import { generalInquiryMessage } from '@/features/whatsapp/buildMessage'
import { useSettings } from '@/features/settings/SettingsProvider'
import { fetchCategoryTree } from '@/data/categories'
import { fetchHighlighted } from '@/data/products'
import { useAsync } from '@/lib/useAsync'
import { useDocumentMeta } from '@/lib/useDocumentMeta'
import { useIsDesktop } from '@/animation/useIsDesktop'
import { useReducedMotion } from '@/animation/useReducedMotion'
import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import type { ProductCard as ProductCardData } from '@/lib/domain'

gsap.registerPlugin(ScrollTrigger)

export function HomePage() {
  const settings = useSettings()

  useDocumentMeta({
    title: settings.seo.title,
    description: settings.seo.description,
    image: settings.seo.ogImage || undefined,
  })

  const { data: tree } = useAsync(fetchCategoryTree, [])
  const offers = useAsync(() => fetchHighlighted('offer', 8), [])
  const bestsellers = useAsync(() => fetchHighlighted('bestseller', 8), [])

  return (
    <>
      <Hero />

      {/* z-10 y margen negativo suave: la tarjeta flota sobre el hero sin
          quedar tapada por la foto (antes el solape escondia el titulo). */}
      <section
        className="container-page relative z-10 -mt-5 sm:-mt-6 lg:-mt-8"
        aria-labelledby="buscar"
      >
        <div className="rounded-card border-ink-100 border bg-white p-4 shadow-lg sm:p-6 lg:p-8">
          <h2 id="buscar" className="text-ink-900 mb-3 text-base font-bold lg:text-lg">
            ¿Qué necesitas para tu obra?
          </h2>
          <SearchBar id="buscador-home" size="lg" />
          <p className="text-ink-500 mt-2.5 text-xs">
            Combina nombre, medida, color o marca. Ejemplos: “amoladora 9
            pulgadas”, “spray blanco”, “tornillo 4x1”.
          </p>
        </div>
      </section>

      <HomePromotions />

      <HighlightSection
        id="ofertas"
        title="Ofertas"
        subtitle="Precios que nos llegaron bien y te los pasamos igual."
        state={offers}
        moreTo="/catalogo?oferta=1"
      />

      <HighlightSection
        id="mas-vendidos"
        title="Más vendidos"
        subtitle="Lo que los maestros nos piden todas las semanas."
        state={bestsellers}
        moreTo="/catalogo?mas-vendidos=1"
      />

      <Process />

      {tree && tree.length > 0 ? (
        <section className="container-page mt-14 lg:mt-20" aria-labelledby="categorias">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <h2
              id="categorias"
              className="text-ink-900 text-xl font-extrabold tracking-tight"
            >
              Explora por categoría
            </h2>
            <ButtonLink to="/catalogo" variant="outline" size="sm">
              Ver catálogo
            </ButtonLink>
          </div>
          <CategoryCards tree={tree} />
        </section>
      ) : null}

      <Advice />
    </>
  )
}

function Hero() {
  const { homeHero } = useSettings()
  const desktopSrc =
    homeHero.imageDesktopUrl || homeHero.imageUrl || homeHero.imageMobileUrl
  const mobileSrc =
    homeHero.imageMobileUrl || homeHero.imageDesktopUrl || homeHero.imageUrl
  const hasPhoto = Boolean(desktopSrc || mobileSrc)
  const sectionRef = useRef<HTMLElement>(null)
  const mediaRef = useRef<HTMLDivElement>(null)
  const isDesktop = useIsDesktop()
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    const section = sectionRef.current
    const media = mediaRef.current
    if (!hasPhoto || !isDesktop || reducedMotion || !section || !media) return

    const ctx = gsap.context(() => {
      gsap.fromTo(
        media,
        { yPercent: -6 },
        {
          yPercent: 10,
          ease: 'none',
          scrollTrigger: {
            trigger: section,
            start: 'top top',
            end: 'bottom top',
            scrub: 0.55,
          },
        },
      )
    }, section)

    return () => ctx.revert()
  }, [hasPhoto, isDesktop, reducedMotion])

  return (
    <section
      ref={sectionRef}
      className="relative z-0 overflow-hidden bg-ink-900 pt-12 sm:pt-16 lg:pt-20"
    >
      {hasPhoto ? (
        <>
          <div
            ref={mediaRef}
            className={
              isDesktop
                ? 'absolute inset-0 origin-center scale-110 will-change-transform'
                : 'absolute inset-0'
            }
          >
            {/* Dos recortes distintos: el celular ya no usa la panoramica del PC. */}
            {mobileSrc ? (
              <img
                src={mobileSrc}
                alt={homeHero.imageAlt}
                fetchPriority="high"
                decoding="sync"
                className="absolute inset-0 size-full object-cover object-center md:hidden"
              />
            ) : null}
            {desktopSrc ? (
              <img
                src={desktopSrc}
                alt=""
                aria-hidden={mobileSrc ? true : undefined}
                fetchPriority="high"
                decoding="sync"
                className="absolute inset-0 hidden size-full object-cover object-center md:block"
              />
            ) : null}
          </div>
          <div
            className="absolute inset-0 bg-gradient-to-r from-ink-950/90 via-ink-950/75 to-ink-950/40"
            aria-hidden="true"
          />
          <div
            className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-ink-950/50 to-transparent sm:h-20"
            aria-hidden="true"
          />
        </>
      ) : (
        <div
          className="from-ink-950 via-ink-900 to-brand-900 absolute inset-0 bg-gradient-to-br"
          aria-hidden="true"
        />
      )}

      <div className="container-page relative pb-14 sm:pb-16 lg:pb-20">
        <p className="text-amber-brand text-sm font-bold uppercase tracking-wide">
          Chillogallo, Sur de Quito
        </p>
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Por qué confiar">
          <li className="rounded-full bg-white/12 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
            Desde 2002
          </li>
          <li className="rounded-full bg-white/12 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
            24 años asesorando obras
          </li>
          <li className="rounded-full bg-white/12 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
            Cotización por WhatsApp
          </li>
        </ul>
        <h1 className="mt-4 max-w-2xl text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
          {homeHero.title}
        </h1>
        <p className="text-ink-100 mt-5 max-w-xl text-base leading-relaxed sm:text-lg">
          {homeHero.subtitle}
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <ButtonLink
            to="/catalogo"
            size="lg"
            className="min-h-12 px-8 text-base shadow-lg shadow-brand-900/40 sm:min-w-[12.5rem]"
          >
            {homeHero.primaryCta}
          </ButtonLink>
          <WhatsAppButton
            id="hero-whatsapp-cta"
            message={generalInquiryMessage()}
            size="lg"
            className="min-h-12 sm:min-w-[12.5rem]"
          >
            {homeHero.secondaryCta}
          </WhatsAppButton>
        </div>
      </div>
    </section>
  )
}

function Process() {
  const { homeProcess } = useSettings()
  if (homeProcess.length === 0) return null

  return (
    <section className="container-page mt-14 lg:mt-20" aria-labelledby="como-funciona">
      <h2
        id="como-funciona"
        className="text-ink-900 text-xl font-extrabold tracking-tight"
      >
        Cómo pedir en 5 pasos
      </h2>
      <p className="text-ink-600 mt-2 max-w-2xl text-sm">
        No hay pagos en el sitio. Armas tu lista, te generamos la cotización y
        cerramos por WhatsApp.
      </p>

      <ol className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {homeProcess.map((step, index) => (
          <li
            key={step.title}
            data-reveal
            className="card-hover-desktop border-ink-100 rounded-card border bg-white p-5 will-change-transform"
          >
            <span className="bg-brand-50 text-brand-700 grid size-9 place-items-center rounded-full text-sm font-extrabold">
              {index + 1}
            </span>
            <h3 className="text-ink-900 mt-3 text-sm font-bold">{step.title}</h3>
            <p className="text-ink-600 mt-1.5 text-sm leading-relaxed">
              {step.text}
            </p>
          </li>
        ))}
      </ol>
    </section>
  )
}

function HighlightSection({
  id,
  title,
  subtitle,
  state,
  moreTo,
}: {
  id: string
  title: string
  subtitle: string
  state: { data: ProductCardData[] | undefined; loading: boolean }
  moreTo: string
}) {
  // Si el admin no marcó nada, la seccion simplemente no aparece.
  if (!state.loading && (state.data ?? []).length === 0) return null

  return (
    <section className="container-page mt-14 lg:mt-20" aria-labelledby={id}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id={id}
            className="text-ink-900 text-xl font-extrabold tracking-tight"
          >
            {title}
          </h2>
          <p className="text-ink-600 mt-1 text-sm">{subtitle}</p>
        </div>
        <ButtonLink to={moreTo} variant="outline" size="sm">
          Ver más
        </ButtonLink>
      </div>

      {state.loading ? (
        <div className="-mx-4 flex gap-4 overflow-hidden px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="w-[min(72vw,14rem)] shrink-0 sm:w-56">
              <ProductCardSkeleton />
            </div>
          ))}
        </div>
      ) : (
        <InfiniteMarquee
          className="-mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
          items={state.data ?? []}
          getKey={(product) => product.id}
          ariaLabel={title}
          secondsPerItem={4.5}
          minDuration={22}
          resumeDelayMs={1500}
          listClassName="flex gap-4 pr-4"
          renderItem={(product, { clone, index }) => (
            <div className="w-[min(72vw,14rem)] shrink-0 sm:w-56">
              <ProductCard
                product={product}
                compact
                eager={!clone && index < 4}
                interactive={!clone}
              />
            </div>
          )}
        />
      )}
    </section>
  )
}

function Advice() {
  const settings = useSettings()

  return (
    <section className="container-page mt-14 mb-4 lg:mt-20 lg:mb-8">
      <div
        data-reveal
        className="rounded-card bg-sky-brand/60 border-sky-brand grid gap-6 border p-6 will-change-transform sm:p-10 lg:grid-cols-[1.4fr_1fr] lg:items-center"
      >
        <div>
          <h2 className="text-ink-900 text-xl font-extrabold tracking-tight">
            No sabes qué comprar? Pregúntanos primero.
          </h2>
          <p className="text-ink-700 mt-3 text-sm leading-relaxed">
            Llevamos desde 2002 atendiendo obras del Sur de Quito. Cuéntanos qué
            vas a hacer y te decimos qué te sirve, qué te sobra y qué te sale más
            barato. Si hay una opción que cuesta menos y te funciona igual, te lo
            decimos.
          </p>
          <p className="text-ink-600 mt-3 text-sm">
            {settings.schedule.weekdays}. {settings.schedule.holidays}.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <WhatsAppButton message={generalInquiryMessage()} size="lg">
            Escríbenos por WhatsApp
          </WhatsAppButton>
          <ButtonLink to="/nosotros" variant="outline" size="lg">
            Conoce la ferretería
          </ButtonLink>
        </div>
      </div>
    </section>
  )
}
