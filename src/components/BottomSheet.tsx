import { useEffect, useId, useRef, type ReactNode } from 'react'
import { useReducedMotion } from '@/animation/useReducedMotion'

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

function getFocusable(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true',
  )
}

type BottomSheetProps = {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  /** Etiqueta del botón de cierre (accesibilidad) */
  closeLabel?: string
  children: ReactNode
  /** Ancla el foco a este elemento al abrir */
  initialFocusRef?: React.RefObject<HTMLElement | null>
}

/**
 * Panel inferior accesible (móvil). Foco atrapado, Escape, scroll del body bloqueado.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  description,
  closeLabel = 'Cerrar',
  children,
  initialFocusRef,
}: BottomSheetProps) {
  const dialogId = useId()
  const titleId = `${dialogId}-title`
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    if (!open) return

    returnFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusPanel = () => {
      const target =
        initialFocusRef?.current ??
        closeRef.current ??
        (panelRef.current ? getFocusable(panelRef.current)[0] : null)
      target?.focus()
    }
    const focusTimer = window.setTimeout(focusPanel, 0)

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== 'Tab' || !panelRef.current) return

      const focusable = getFocusable(panelRef.current)
      if (focusable.length === 0) {
        event.preventDefault()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement

      if (event.shiftKey) {
        if (active === first || active === panelRef.current) {
          event.preventDefault()
          last.focus()
        }
      } else if (active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      returnFocusRef.current?.focus()
    }
  }, [open, onClose, initialFocusRef])

  if (!open) return null

  return (
  <>
    <button
      type="button"
      className="fixed inset-0 z-40 bg-ink-950/40"
      aria-label={closeLabel}
      onClick={onClose}
    />

    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? `${dialogId}-desc` : undefined}
      data-lenis-prevent=""
      className={`border-ink-100 fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col rounded-t-2xl border bg-white shadow-2xl ${
        reducedMotion ? '' : 'animate-[sheet-up_0.28s_ease-out]'
      }`}
    >
      <div
        role="presentation"
        aria-hidden="true"
        className="bg-ink-200 mx-auto mt-3 mb-1 h-1 w-10 shrink-0 rounded-full"
      />

      <header className="border-ink-100 flex shrink-0 items-start justify-between gap-3 border-b px-5 py-4">
        <div className="min-w-0">
          <h2 id={titleId} className="text-ink-900 text-base font-extrabold">
            {title}
          </h2>
          {description ? (
            <p id={`${dialogId}-desc`} className="text-ink-500 mt-0.5 text-sm">
              {description}
            </p>
          ) : null}
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="text-ink-500 hover:text-ink-900 grid size-11 shrink-0 place-items-center rounded-lg text-2xl leading-none"
          aria-label={closeLabel}
        >
          ×
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 pt-3">
        {children}
      </div>
    </div>
  </>
  )
}