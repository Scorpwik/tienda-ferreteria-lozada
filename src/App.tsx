import { lazy, Suspense, useEffect, useState, type ComponentType, type ReactNode } from 'react'
import { matchPath, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import { SettingsProvider } from '@/features/settings/SettingsProvider'
import { CartProvider } from '@/features/cart/CartProvider'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { RequireAdmin } from '@/features/auth/RequireAdmin'
import { AdminToastProvider } from '@/features/admin/AdminToast'
import { Spinner } from '@/components/States'
import { Header } from '@/layout/Header'
import { Footer } from '@/layout/Footer'
import { CartBadge } from '@/layout/CartBadge'
import { WhatsAppFloatingButton } from '@/layout/WhatsAppFloatingButton'
import { AdminLayout } from '@/layout/AdminLayout'
import { ScrollToTop } from '@/layout/ScrollToTop'
import { useStructuredData } from '@/lib/useDocumentMeta'

const HomePage = lazy(() =>
  import('@/pages/Home').then((m) => ({ default: m.HomePage })),
)
const CatalogPage = lazy(() =>
  import('@/pages/Catalog').then((m) => ({ default: m.CatalogPage })),
)
const CategoryPage = lazy(() =>
  import('@/pages/Category').then((m) => ({ default: m.CategoryPage })),
)
const ProductPage = lazy(() =>
  import('@/pages/Product').then((m) => ({ default: m.ProductPage })),
)
const CartPage = lazy(() =>
  import('@/pages/Cart').then((m) => ({ default: m.CartPage })),
)
const QuotePage = lazy(() =>
  import('@/pages/Quote').then((m) => ({ default: m.QuotePage })),
)
const AboutPage = lazy(() =>
  import('@/pages/About').then((m) => ({ default: m.AboutPage })),
)
const PromotionsPage = lazy(() =>
  import('@/pages/Promotions').then((m) => ({ default: m.PromotionsPage })),
)
const NotFoundPage = lazy(() =>
  import('@/pages/NotFound').then((m) => ({ default: m.NotFoundPage })),
)

/** LocalBusiness una sola vez en el árbol (no por página). */
const HARDWARE_STORE_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'HardwareStore',
  name: 'Ferretería Lozada',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Av. Mariscal Sucre s27-184',
    addressLocality: 'Chillogallo',
    addressRegion: 'Quito',
    postalCode: '170607',
    addressCountry: 'EC',
  },
  telephone: '+593995307272',
  openingHours: 'Mo-Fr 08:30-17:15',
  geo: {
    '@type': 'GeoCoordinates',
    latitude: -0.2749581,
    longitude: -78.5523698,
  },
} as const

/**
 * El panel va en chunks aparte: el visitante de la tienda no descarga ni una
 * linea del admin.
 */
const AdminLogin = lazy(() => import('@/pages/admin/AdminLogin'))
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'))
const AdminProducts = lazy(() => import('@/pages/admin/AdminProducts'))
const AdminCategories = lazy(() => import('@/pages/admin/AdminCategories'))
const AdminProductEdit = lazy(() => import('@/pages/admin/AdminProductEdit'))
const AdminQuotes = lazy(() => import('@/pages/admin/AdminQuotes'))
const AdminSettings = lazy(() => import('@/pages/admin/AdminSettings'))
const AdminImport = lazy(() => import('@/pages/admin/AdminImport'))
const AdminPromotions = lazy(() => import('@/pages/admin/AdminPromotions'))

/**
 * Sesion de Supabase Auth solo para el area admin. Asi la tienda publica no
 * consulta la sesion ni la tabla admins en cada visita.
 */
/** Patrones reales de la app. Vercel agrupa visitas por ruta, no por cada producto. */
const ANALYTICS_ROUTES = [
  '/admin/login',
  '/admin/productos/nuevo',
  '/admin/productos/:id',
  '/admin/productos',
  '/admin/categorias',
  '/admin/cotizaciones',
  '/admin/ajustes',
  '/admin/importar',
  '/admin/promociones',
  '/admin',
  '/catalogo/:parentSlug/:childSlug',
  '/catalogo/:parentSlug',
  '/catalogo',
  '/producto/:originId',
  '/carrito/cotizar',
  '/carrito',
  '/nosotros',
  '/promociones',
  '/',
]

function RouteAnalytics() {
  const { pathname } = useLocation()
  const route =
    ANALYTICS_ROUTES.find((pattern) =>
      matchPath({ path: pattern, end: true }, pathname),
    ) ?? pathname

  return <Analytics route={route} path={pathname} />
}

function PublicPageFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner label="Cargando" />
    </div>
  )
}

function AdminArea() {
  return (
    <AuthProvider>
      <AdminToastProvider>
        <Suspense
          fallback={
            <div className="flex min-h-[50vh] items-center justify-center">
              <Spinner label="Cargando el panel" />
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </AdminToastProvider>
    </AuthProvider>
  )
}

type MotionShellProps = { children: ReactNode }

function PublicShell() {
  const [MotionShell, setMotionShell] = useState<ComponentType<MotionShellProps> | null>(
    null,
  )

  useEffect(() => {
    const schedule =
      typeof window.requestIdleCallback === 'function'
        ? window.requestIdleCallback
        : (cb: () => void) => window.setTimeout(cb, 1)
    const cancel =
      typeof window.cancelIdleCallback === 'function'
        ? window.cancelIdleCallback
        : (id: number) => window.clearTimeout(id)

    const id = schedule(() => {
      void import('@/animation/PublicMotionShell').then((m) => {
        setMotionShell(() => m.PublicMotionShell)
      })
    })

    return () => cancel(id as number)
  }, [])

  const routes = (
    <Suspense fallback={<PublicPageFallback />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/catalogo" element={<CatalogPage />} />
        <Route path="/catalogo/:parentSlug" element={<CategoryPage />} />
        <Route
          path="/catalogo/:parentSlug/:childSlug"
          element={<CategoryPage />}
        />
        <Route path="/producto/:originId" element={<ProductPage />} />
        <Route path="/carrito" element={<CartPage />} />
        <Route path="/carrito/cotizar" element={<QuotePage />} />
        <Route path="/nosotros" element={<AboutPage />} />
        <Route path="/promociones" element={<PromotionsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )

  const pageContent = MotionShell ? <MotionShell>{routes}</MotionShell> : routes

  return (
    <CartProvider>
      <a
        href="#contenido"
        className="sr-only-focusable bg-brand-700 focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:px-4 focus:py-2 focus:font-semibold focus:text-white"
      >
        Saltar al contenido
      </a>

      <div className="flex min-h-dvh flex-col">
        <Header actions={<CartBadge />} />

        <main
          id="contenido"
          className="flex-1 pb-[max(4.5rem,env(safe-area-inset-bottom))] lg:pb-0"
        >
          {pageContent}
        </main>

        <Footer />
      </div>

      <WhatsAppFloatingButton />
    </CartProvider>
  )
}

export function App() {
  useStructuredData(HARDWARE_STORE_JSON_LD)

  return (
    <SettingsProvider>
      <RouteAnalytics />
      <ScrollToTop />
      <Routes>
        {/* Panel admin: sin Header, Footer ni carrito de la tienda. */}
        <Route element={<AdminArea />}>
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route
            path="/admin"
            element={
              <RequireAdmin>
                <AdminLayout />
              </RequireAdmin>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="productos" element={<AdminProducts />} />
            <Route path="productos/nuevo" element={<AdminProductEdit />} />
            <Route path="productos/:id" element={<AdminProductEdit />} />
            <Route path="categorias" element={<AdminCategories />} />
            <Route path="cotizaciones" element={<AdminQuotes />} />
            <Route path="ajustes" element={<AdminSettings />} />
            <Route path="importar" element={<AdminImport />} />
            <Route path="promociones" element={<AdminPromotions />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>

        {/* Todo lo demas es la tienda publica. */}
        <Route path="*" element={<PublicShell />} />
      </Routes>
    </SettingsProvider>
  )
}