---
name: mobile-first-responsive
description: Diseña y revisa layouts mobile-first para tienda web — breakpoints Tailwind 4, touch, tipografía y patrones móvil/escritorio. Use when adapting UI for phone and desktop, responsive bugs, or layout on small screens.
license: MIT
---

Síntesis de [Vercel Web Interface Guidelines](https://vercel.com/design/guidelines) (touch & layout) + arquitectura de Ferretería Lozada.

Lee `.cursor/ARCHITECTURE.md` — **mobile-first** es requisito del negocio.

## Principios

1. Diseña primero para **320–430px**; luego `sm:`, `md:`, `lg:` de Tailwind 4.
2. La mayoría de visitas buscan producto y cotizan — minimiza pasos y scroll hasta la acción.
3. Hero/portada distinta móvil vs desktop ya es patrón del sitio; mantén paridad de mensaje, no de pixel idéntico.

## Tailwind 4 (referencia rápida)

| Prefijo | Min width |
| --- | --- |
| (default) | 0 |
| `sm:` | 640px |
| `md:` | 768px |
| `lg:` | 1024px |
| `xl:` | 1280px |

- Usa utilidades del theme del proyecto; no anchos mágicos repetidos — extrae patrones a componentes existentes en `src/components/`.
- Grids de catálogo: 2 columnas en móvil suele ser óptimo para ferretería; sube columnas en `md:`/`lg:`.

## Touch e interacción

- **Hit target ≥ 44×44px** en controles táctiles (botones carrito, filtros, variantes).
- Si el visual es &lt;24px, expande el área clickeable con padding.
- `touch-action: manipulation` en botones que no deben disparar zoom doble-tap.
- Inputs: **font-size ≥ 16px** en móvil para evitar zoom en iOS.
- No deshabilitar zoom del navegador.
- Sticky header: no tape el foco del teclado ni el elemento enfocado.

## Layout y contenido

- Evita tablas anchas sin scroll controlado; en móvil prefiere listas/definition lists para **especificaciones**.
- Imágenes de producto: `width`/`height` o aspect-ratio fijo para evitar CLS.
- `prefers-reduced-motion`: desactiva animaciones decorativas (Lenis/GSAP ya tienen hook en el proyecto).

## Escritorio

- Aprovecha ancho para **tablas de especificaciones** y comparación de variantes lado a lado.
- No esconder funciones críticas solo en hover; deben existir en touch.

## Checklist de revisión

Al terminar un cambio de UI, verifica en móvil (DevTools 390px):

- [ ] Sin overflow horizontal
- [ ] CTA principal visible sin scroll excesivo en ficha y carrito
- [ ] Filtros usables con dedo
- [ ] Texto legible (cuerpo ≥ text-base en móvil donde aplique)

Para auditoría línea a línea, combina con skill `web-design-guidelines` (fetch de reglas Vercel).