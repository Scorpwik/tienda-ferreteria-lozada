import { useEffect, useRef } from 'react'

/**
 * Cierra un panel cuando el puntero cae fuera de su raiz. El header y la
 * burbuja de WhatsApp quedan por encima de la capa local, asi que este
 * listener cubre esos clics.
 */
export function useDismissOnOutsidePointer<T extends HTMLElement>(
  open: boolean,
  onDismiss: () => void,
) {
  const rootRef = useRef<T>(null)
  const onDismissRef = useRef(onDismiss)
  onDismissRef.current = onDismiss

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: PointerEvent) => {
      const root = rootRef.current
      const target = event.target
      if (!root || !(target instanceof Node) || root.contains(target)) return
      onDismissRef.current()
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [open])

  return rootRef
}

/**
 * Lenis escucha la rueda en window y se lleva el scroll de la pagina.
 * Este listener frena ese evento y mueve solo la lista.
 */
export function useNestedScroll(active: boolean) {
  const ref = useRef<HTMLUListElement>(null)

  useEffect(() => {
    const list = ref.current
    if (!list || !active) return

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      event.stopPropagation()
      const multiplier =
        event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? list.clientHeight : 1
      list.scrollTop += event.deltaY * multiplier
    }

    list.addEventListener('wheel', onWheel, { passive: false })
    return () => list.removeEventListener('wheel', onWheel)
  }, [active])

  return ref
}

export function scrollOptionIntoView(list: HTMLElement | null, optionId: string) {
  if (!list) return
  const option = document.getElementById(optionId)
  if (!option || !list.contains(option)) return

  const listRect = list.getBoundingClientRect()
  const optionRect = option.getBoundingClientRect()
  if (optionRect.top < listRect.top) {
    list.scrollTop -= listRect.top - optionRect.top
  } else if (optionRect.bottom > listRect.bottom) {
    list.scrollTop += optionRect.bottom - listRect.bottom
  }
}

export function suggestionListClass(maxHeight = 'max-h-80') {
  return `border-ink-100 absolute z-20 mt-1 w-full overflow-y-auto overscroll-contain rounded-xl border bg-white py-1 shadow-lg ${maxHeight}`
}

/** Capa a pantalla completa: el clic afuera cierra y no activa lo que hay debajo. */
export function SuggestionDismissLayer({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      className="fixed inset-0 z-10"
      aria-hidden="true"
      onMouseDown={(event) => {
        event.preventDefault()
        onDismiss()
      }}
    />
  )
}
