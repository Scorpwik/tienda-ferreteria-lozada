import { useEffect, useRef, useState } from 'react'

/** Oculta el FAB al bajar y lo muestra al subir para no tapar el grid. */
export function useFabOnScroll() {
  const [visible, setVisible] = useState(true)
  const lastY = useRef(0)
  const ticking = useRef(false)

  useEffect(() => {
    lastY.current = window.scrollY

    const onScroll = () => {
      if (ticking.current) return
      ticking.current = true
      requestAnimationFrame(() => {
        const y = window.scrollY
        const delta = y - lastY.current
        if (y < 64) {
          setVisible(true)
        } else if (delta > 10) {
          setVisible(false)
        } else if (delta < -10) {
          setVisible(true)
        }
        lastY.current = y
        ticking.current = false
      })
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return visible
}