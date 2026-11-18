# Skills de diseño UI/UX (Cursor)

Conjunto de **Agent Skills** para que los agentes de Cursor diseñen y revisen la tienda Ferretería Lozada con criterio mobile-first, accesibilidad y foco en venta/cotización.

Lee siempre `.cursor/cursor_rules` y `.cursor/ARCHITECTURE.md` además de estas skills.

| Skill | Para qué sirve | Origen |
| --- | --- | --- |
| **frontend-design** | Dirección visual intencional; evitar estéticas genéricas de IA; tipografía, layout y motion con criterio. | [anthropics/skills](https://github.com/anthropics/skills) (Apache-2.0) |
| **web-design-guidelines** | Auditoría de código UI contra las Web Interface Guidelines de Vercel (`file:line`). | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) |
| **accessibility** | WCAG 2.2, teclado, contraste, formularios y árbol de accesibilidad. | [addyosmani/web-quality-skills](https://github.com/addyosmani/web-quality-skills) (MIT) |
| **ui-design-critique** | Informe de crítica de página/componente con problemas concretos y prioridades. | Adaptado desde [kursku/skills](https://github.com/kursku/skills) + heurísticas Nielsen |
| **ux-writing** | Microcopy: botones, errores, vacíos, tono español ecuatoriano. | [slb2248/ai-ux-skills](https://github.com/slb2248/ai-ux-skills) (MIT) |
| **mobile-first-responsive** | Breakpoints Tailwind 4, touch targets, inputs en móvil, CLS. | Síntesis Vercel Guidelines + arquitectura local (MIT) |
| **commerce-product-pages** | Fichas de ferretería: medidas, variantes, specs, carrito/cotización. | Skill propia del repo (MIT) |

Cada carpeta incluye `ATTRIBUTION.md` con licencia y URL de origen.

**Nota:** En `.agents/skills/` hay otras skills (React, Tailwind, GSAP, etc.). Las de esta carpeta están orientadas a **diseño y UX** para agentes en Cursor.