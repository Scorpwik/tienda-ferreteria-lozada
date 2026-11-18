import { WhatsAppIcon } from '@/features/whatsapp/WhatsAppButton'
import { useSettings } from '@/features/settings/SettingsProvider'
import { generalInquiryMessage, whatsappUrl } from '@/features/whatsapp/buildMessage'
import { useFabOnScroll } from '@/layout/useFabOnScroll'

/**
 * Burbuja de contacto general, fija en la esquina inferior derecha.
 * No reemplaza CTAs puntuales (consultar disponibilidad, solicitar combo, hero).
 */
export function WhatsAppFloatingButton() {
  const { whatsappNumber } = useSettings()
  const visible = useFabOnScroll()

  return (
    <a
      href={whatsappUrl(whatsappNumber, generalInquiryMessage())}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Pedir por WhatsApp"
      className={`fixed z-40 grid size-12 place-items-center rounded-full bg-[#1c8c4c] text-white shadow-lg shadow-ink-900/25 transition-[transform,opacity] duration-200 hover:scale-105 hover:bg-[#166b3b] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1c8c4c] focus-visible:ring-offset-2 sm:size-14 ${
        visible
          ? 'pointer-events-auto translate-y-0 opacity-100'
          : 'pointer-events-none translate-y-3 opacity-0'
      }`}
      style={{
        right: 'max(0.75rem, env(safe-area-inset-right))',
        bottom: 'max(0.75rem, env(safe-area-inset-bottom))',
      }}
    >
      <WhatsAppIcon className="size-6 sm:size-7" />
    </a>
  )
}
