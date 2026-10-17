import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/** Cada cambio de pagina arranca arriba. Los query params (filtros del
 *  panel) no deben saltar el scroll: eso se siente como una recarga. */
export function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [pathname])

  return null
}
