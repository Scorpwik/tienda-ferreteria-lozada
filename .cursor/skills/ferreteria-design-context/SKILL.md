---
name: ferreteria-design-context
description: Contexto de marca, stack y audiencia para UI de Ferretería Lozada. Lee esto antes de aplicar frontend-design o accessibility en este repo.
license: MIT
---

## Reglas del proyecto

Lee `.cursor/cursor_rules` y `.cursor/ARCHITECTURE.md` en cada tarea de UI.

## Diseño visual y marca

- **Objetivo:** vender ferretería en línea; el maestro de obra entiende el producto y cotiza en pocos toques desde el celular.
- **Marca:** colores en Tailwind (`primary` #F23005, secundarios del config). No inventes paletas nuevas ni estéticas SaaS genéricas.
- **Stack:** React 19 + Vite 7 + TypeScript + **solo** Tailwind CSS 4.
- **Tono:** ferretería de barrio confiable y proveedor profesional — clara, utilitaria, sin artificio.
- **Tipografía:** refina en el theme del proyecto; no impongas fuentes display que contradigan producción.
- **Animación:** Lenis + GSAP + ScrollTrigger; respeta `prefers-reduced-motion` (`useReducedMotion`).

## Accesibilidad en este sitio

- **Móvil primero:** objetivos táctiles ≥ 44px, contraste en exteriores, teclado en filtros y carrito.
- No rompas contraste de marca (#F23005); ajusta tokens en Tailwind.
- Iconos header/carrito: `aria-label` en español.
- Cotización: errores ligados al campo, copy en español ecuatoriano claro.

## Skills canónicas (sin duplicar en `.cursor/skills`)

| Tema | Usa |
| --- | --- |
| Diseño visual / anti‑patrones | `.agents/skills/frontend-design` |
| WCAG / a11y profunda | `.agents/skills/accessibility` |
| React rendimiento | `.agents/skills/react-best-practices` |
| Tailwind | `.agents/skills/tailwind-css-patterns` |