import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
import { useSettings } from '@/features/settings/SettingsProvider'

const links = [
  { to: '/admin', label: 'Resumen', end: true },
  { to: '/admin/productos', label: 'Productos', end: false },
  { to: '/admin/categorias', label: 'Categorías', end: false },
  { to: '/admin/promociones', label: 'Combos y promociones', end: false },
  { to: '/admin/cotizaciones', label: 'Cotizaciones', end: false },
  { to: '/admin/importar', label: 'Importar catálogo', end: false },
  { to: '/admin/ajustes', label: 'Ajustes del sitio', end: false },
]

function linkClass({ isActive }: { isActive: boolean }): string {
  return isActive
    ? 'bg-brand-50 text-brand-800 block rounded-lg px-3 py-2.5 text-sm font-bold'
    : 'text-ink-700 hover:bg-ink-50 hover:text-ink-900 block rounded-lg px-3 py-2.5 text-sm font-medium'
}

export function AdminLayout() {
  const { admin, signOut } = useAuth()
  const { businessName } = useSettings()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="bg-ink-50 min-h-dvh">
      <header className="border-ink-100 sticky top-0 z-30 border-b bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-controls="admin-nav"
              className="text-ink-700 hover:bg-ink-50 -ml-2 rounded-lg px-2.5 py-2 lg:hidden"
            >
              <span className="sr-only">
                {menuOpen ? 'Cerrar menú' : 'Abrir menú'}
              </span>
              <svg
                viewBox="0 0 24 24"
                className="size-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
              </svg>
            </button>

            <div className="leading-tight">
              <p className="text-ink-900 text-sm font-extrabold">
                Panel de {businessName}
              </p>
              <p className="text-ink-500 text-xs">
                {admin?.name ?? 'Administración'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/"
              className="text-ink-600 hover:text-brand-700 hidden text-sm font-semibold sm:block"
            >
              Ver la tienda
            </a>
            <button
              type="button"
              onClick={() => void signOut()}
              className="border-ink-200 text-ink-800 hover:border-brand-600 hover:text-brand-700 rounded-lg border px-3 py-2 text-sm font-semibold"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6">
        <nav
          id="admin-nav"
          aria-label="Secciones del panel"
          className={`${
            menuOpen ? 'block' : 'hidden'
          } border-ink-100 absolute left-4 right-4 z-20 rounded-card border bg-white p-2 shadow-lg lg:static lg:block lg:w-56 lg:shrink-0 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none`}
        >
          <ul className="space-y-1">
            {links.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  end={link.end}
                  className={linkClass}
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <main id="contenido" className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
