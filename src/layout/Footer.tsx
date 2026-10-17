import { Link } from 'react-router-dom'
import { useSettings } from '@/features/settings/SettingsProvider'
import { WhatsAppButton } from '@/features/whatsapp/WhatsAppButton'
import { generalInquiryMessage } from '@/features/whatsapp/buildMessage'

export function Footer() {
  const settings = useSettings()
  const year = new Date().getFullYear()

  return (
    <footer className="bg-ink-900 mt-20 text-white">
      <div className="container-wide grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-lg font-extrabold">{settings.businessName}</p>
          <p className="text-ink-200 mt-3 text-sm leading-relaxed">
            Tu ferretería en Chillogallo desde 2002. Te asesoramos antes de
            venderte.
          </p>
        </div>

        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide">Dónde estamos</h2>
          <address className="text-ink-200 mt-3 text-sm not-italic leading-relaxed">
            {settings.address}
          </address>
          <p className="text-ink-200 mt-2 text-sm">{settings.aboutCoverage}</p>
        </div>

        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide">Horarios</h2>
          <ul className="text-ink-200 mt-3 space-y-1 text-sm">
            <li>{settings.schedule.weekdays}</li>
            <li>Sábado: {settings.schedule.saturday}</li>
            <li>Domingo: {settings.schedule.sunday}</li>
            <li className="text-amber-brand">{settings.schedule.holidays}</li>
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide">Contacto</h2>
          <a
            href={`tel:+${settings.whatsappNumber}`}
            className="mt-3 block text-sm font-semibold hover:underline"
          >
            {settings.whatsappDisplay}
          </a>
          <WhatsAppButton message={generalInquiryMessage()} className="mt-4">
            Escríbenos
          </WhatsAppButton>

          {Object.keys(settings.socialLinks).length > 0 ? (
            <ul className="mt-4 flex gap-4 text-sm">
              {Object.entries(settings.socialLinks).map(([name, url]) => (
                <li key={name}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="capitalize hover:underline"
                  >
                    {name}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <div className="border-ink-800 border-t">
        <div className="container-wide text-ink-300 flex flex-col gap-3 py-6 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {settings.businessName}. Los precios del sitio son
            referenciales y se confirman por WhatsApp.
          </p>
          <nav className="flex gap-4">
            <Link to="/catalogo" className="hover:underline">
              Catálogo
            </Link>
            <Link to="/promociones" className="hover:underline">
              Promociones
            </Link>
            <Link to="/nosotros" className="hover:underline">
              Sobre nosotros
            </Link>
            <Link to="/admin/login" className="hover:underline">
              Administración
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}
