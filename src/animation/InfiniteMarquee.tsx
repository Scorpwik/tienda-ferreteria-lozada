import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useReducedMotion } from '@/animation/useReducedMotion'

type Props<T> = {
  items: T[]
  getKey: (item: T, index: number) => string
  renderItem: (item: T, ctx: { clone: boolean; index: number }) => ReactNode
  ariaLabel: string
  /** Pausa el loop (p. ej. mientras un lightbox está abierto). */
  paused?: boolean
  /** Segundos por ítem; el total se acota a un mínimo razonable. */
  secondsPerItem?: number
  minDuration?: number
  /** Tras el último scroll/arrastre del usuario, espera esto para retomar. */
  resumeDelayMs?: number
  className?: string
  listClassName?: string
}

type MarqueeControls = {
  nudge: (delta: number) => void
}

/**
 * Cinta horizontal infinita: avanza sola y el usuario puede hacer scroll
 * (táctil, rueda del ratón, flechas). Cuando suelta, espera 1.5s y retoma.
 */
export function InfiniteMarquee<T>({
  items,
  getKey,
  renderItem,
  ariaLabel,
  paused = false,
  secondsPerItem = 5,
  minDuration = 16,
  resumeDelayMs = 1500,
  className = '',
  listClassName = 'flex gap-3 pr-3',
}: Props<T>) {
  const reducedMotion = useReducedMotion()
  const scrollerRef = useRef<HTMLDivElement>(null)
  const firstSetRef = useRef<HTMLUListElement>(null)
  const pausedPropRef = useRef(paused)
  const resumeDelayRef = useRef(resumeDelayMs)
  const controlsRef = useRef<MarqueeControls | null>(null)
  const [overflows, setOverflows] = useState(false)

  pausedPropRef.current = paused
  resumeDelayRef.current = resumeDelayMs

  const autoPlay = !reducedMotion && overflows && items.length >= 2

  useEffect(() => {
    const scroller = scrollerRef.current
    const firstSet = firstSetRef.current
    if (!scroller || !firstSet || items.length === 0) return

    const measure = () => {
      setOverflows(firstSet.scrollWidth > scroller.clientWidth + 8)
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(scroller)
    observer.observe(firstSet)
    return () => observer.disconnect()
  }, [items])

  useEffect(() => {
    const scroller = scrollerRef.current
    const firstSet = firstSetRef.current
    if (!scroller || !firstSet || !autoPlay) {
      controlsRef.current = null
      return
    }

    let userPaused = false
    let resumeTimer: number | null = null
    let raf = 0
    let last = performance.now()
    let pos = 0
    let lastProgrammatic = 0
    let lastSetWidth = 0

    const setWidth = () => firstSet.offsetWidth

    const applyScroll = (next: number) => {
      pos = next
      lastProgrammatic = performance.now()
      if (Math.abs(scroller.scrollLeft - next) > 0.4) {
        scroller.scrollLeft = next
      }
    }

    const wrapPos = (value: number, width: number) => {
      if (width <= 0) return value
      let next = value
      while (next >= width * 2) next -= width
      while (next < width) next += width
      return next
    }

    const syncFromDom = () => {
      const width = setWidth()
      pos = wrapPos(scroller.scrollLeft, width)
      if (Math.abs(scroller.scrollLeft - pos) > 0.4) {
        lastProgrammatic = performance.now()
        scroller.scrollLeft = pos
      }
    }

    const width = setWidth()
    lastSetWidth = width
    applyScroll(width)

    const duration = Math.max(minDuration, items.length * secondsPerItem)
    const pixelsPerSecond = () => {
      const current = setWidth()
      return current > 0 ? current / duration : 0
    }

    const clearResume = () => {
      if (resumeTimer !== null) {
        window.clearTimeout(resumeTimer)
        resumeTimer = null
      }
    }

    const scheduleResume = () => {
      clearResume()
      resumeTimer = window.setTimeout(() => {
        resumeTimer = null
        userPaused = false
        last = performance.now()
        syncFromDom()
      }, resumeDelayRef.current)
    }

    const pauseForInteraction = (resumeAfterIdle: boolean) => {
      userPaused = true
      if (resumeAfterIdle) scheduleResume()
      else clearResume()
    }

    const tick = (now: number) => {
      const dt = Math.min(0.048, (now - last) / 1000)
      last = now
      const currentWidth = setWidth()
      if (currentWidth > 0 && Math.abs(currentWidth - lastSetWidth) > 1) {
        const ratio = lastSetWidth > 0 ? pos / lastSetWidth : 1
        lastSetWidth = currentWidth
        applyScroll(wrapPos(ratio * currentWidth, currentWidth))
      }
      if (!userPaused && !pausedPropRef.current) {
        applyScroll(wrapPos(pos + pixelsPerSecond() * dt, currentWidth))
      }
      raf = requestAnimationFrame(tick)
    }

    const onScroll = () => {
      if (performance.now() - lastProgrammatic < 80) return
      pauseForInteraction(true)
      syncFromDom()
    }

    const onPointerUp = () => pauseForInteraction(true)
    const onPointerDown = () => {
      pauseForInteraction(false)
      window.addEventListener('pointerup', onPointerUp, { once: true })
      window.addEventListener('pointercancel', onPointerUp, { once: true })
    }
    const onTouchStart = () => pauseForInteraction(false)
    const onTouchEnd = () => pauseForInteraction(true)

    controlsRef.current = {
      nudge(delta) {
        pauseForInteraction(true)
        applyScroll(wrapPos(scroller.scrollLeft + delta, setWidth()))
      },
    }

    scroller.addEventListener('scroll', onScroll, { passive: true })
    scroller.addEventListener('pointerdown', onPointerDown)
    scroller.addEventListener('touchstart', onTouchStart, { passive: true })
    scroller.addEventListener('touchend', onTouchEnd, { passive: true })
    scroller.addEventListener('touchcancel', onTouchEnd, { passive: true })

    raf = requestAnimationFrame(tick)

    return () => {
      controlsRef.current = null
      cancelAnimationFrame(raf)
      clearResume()
      scroller.removeEventListener('scroll', onScroll)
      scroller.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
      scroller.removeEventListener('touchstart', onTouchStart)
      scroller.removeEventListener('touchend', onTouchEnd)
      scroller.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [autoPlay, items, minDuration, secondsPerItem])

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller || !overflows) return

    const onWheel = (event: WheelEvent) => {
      const delta =
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
          ? event.deltaX
          : event.deltaY
      if (delta === 0) return
      event.preventDefault()
      if (controlsRef.current) {
        controlsRef.current.nudge(delta)
      } else {
        scroller.scrollLeft += delta
      }
    }

    scroller.addEventListener('wheel', onWheel, { passive: false })
    return () => scroller.removeEventListener('wheel', onWheel)
  }, [overflows, items])

  const nudge = (direction: -1 | 1) => {
    const scroller = scrollerRef.current
    const firstSet = firstSetRef.current
    if (!scroller) return
    const card = firstSet?.querySelector('li')
    const step =
      (card?.getBoundingClientRect().width ?? scroller.clientWidth * 0.6) + 16
    const delta = direction * step
    if (controlsRef.current) {
      controlsRef.current.nudge(delta)
      return
    }
    scroller.scrollBy({ left: delta, behavior: 'smooth' })
  }

  if (items.length === 0) return null

  const renderSet = (clone: boolean) =>
    items.map((item, index) => (
      <li
        key={`${clone ? 'c' : 'o'}-${getKey(item, index)}`}
        aria-hidden={clone || undefined}
      >
        {renderItem(item, { clone, index })}
      </li>
    ))

  return (
    <div className="relative">
      <div
        ref={scrollerRef}
        className={`overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
        role="region"
        aria-label={ariaLabel}
        aria-roledescription="carrusel"
        data-lenis-prevent
      >
        <div className="flex w-max">
          <ul ref={firstSetRef} className={listClassName}>
            {renderSet(false)}
          </ul>
          {autoPlay ? (
            <>
              {/* Sin inert: el loop muestra esta copia, y el clic tiene que abrir el producto. */}
              <ul className={listClassName} aria-hidden="true">
                {renderSet(true)}
              </ul>
              <ul className={listClassName} aria-hidden="true">
                {renderSet(true)}
              </ul>
            </>
          ) : null}
        </div>
      </div>

      {overflows ? (
        <>
          <NudgeButton
            direction="left"
            label={`Ver anteriores: ${ariaLabel}`}
            onClick={() => nudge(-1)}
          />
          <NudgeButton
            direction="right"
            label={`Ver siguientes: ${ariaLabel}`}
            onClick={() => nudge(1)}
          />
        </>
      ) : null}
    </div>
  )
}

function NudgeButton({
  direction,
  label,
  onClick,
}: {
  direction: 'left' | 'right'
  label: string
  onClick: () => void
}) {
  const sideClass =
    direction === 'left' ? 'left-1 sm:left-2' : 'right-1 sm:right-2'

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`border-ink-200 text-ink-800 hover:border-brand-600 hover:text-brand-700 absolute top-1/2 z-10 hidden size-11 -translate-y-1/2 place-items-center rounded-full border bg-white/95 shadow-md backdrop-blur-sm md:grid ${sideClass}`}
    >
      <svg
        viewBox="0 0 24 24"
        className="size-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {direction === 'left' ? (
          <path d="M15 6l-6 6 6 6" />
        ) : (
          <path d="M9 6l6 6-6 6" />
        )}
      </svg>
    </button>
  )
}
