import type { ReactNode } from 'react'
import { LenisProvider } from '@/animation/LenisProvider'
import { PageTransition } from '@/animation/PageTransition'
import { RevealOnScroll } from '@/animation/RevealOnScroll'

/** Lenis + reveals + transiciones de ruta; se carga en diferido para no hinchar el chunk inicial. */
export function PublicMotionShell({ children }: { children: ReactNode }) {
  return (
    <LenisProvider>
      <RevealOnScroll />
      <PageTransition>{children}</PageTransition>
    </LenisProvider>
  )
}