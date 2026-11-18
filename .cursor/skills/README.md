# Skills para agentes Cursor

Skills en **dos carpetas**: diseño/UX en `.cursor/skills/`; stack y calidad en `.agents/skills/` (vía `skills-lock.json`).

**Siempre:** `.cursor/cursor_rules`, `.cursor/ARCHITECTURE.md`, y la skill **`ferreteria-design-context`** antes de cambiar UI.

## `.cursor/skills/` (diseño UX, este catálogo)

| Skill | Para qué sirve |
| --- | --- |
| **ferreteria-design-context** | Marca, audiencia, stack y reglas locales |
| **web-design-guidelines** | Auditoría Web Interface Guidelines (Vercel) |
| **ui-design-critique** | Informe de crítica de página/componente |
| **ux-writing** | Microcopy en español ecuatoriano |
| **mobile-first-responsive** | Móvil, touch, breakpoints Tailwind 4 |
| **commerce-product-pages** | Fichas de producto y catálogo |

## `.agents/skills/` (stack; 23 en `skills-lock.json`)

| Skill | Para qué sirve | Fuente |
| --- | --- | --- |
| **accessibility** | WCAG 2.2, auditoría a11y | [addyosmani/web-quality-skills](https://github.com/addyosmani/web-quality-skills) |
| **composition-patterns** | Patrones React por composición | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) |
| **deploy-to-vercel** | Deploy en Vercel | vercel-labs/agent-skills |
| **frontend-design** | Dirección visual, anti‑patrones IA | [anthropics/skills](https://github.com/anthropics/skills) |
| **gsap-core** … **gsap-utils** | Animación GSAP | [greensock/gsap-skills](https://github.com/greensock/gsap-skills) |
| **nodejs-backend-patterns** | Patrones backend Node | [wshobson/agents](https://github.com/wshobson/agents) |
| **nodejs-best-practices** | Node.js | antigravity-awesome-skills |
| **playwright-dev** | E2E / Playwright | microsoft/playwright |
| **react-best-practices** | Rendimiento React | vercel-labs/agent-skills |
| **seo** | SEO técnico | addyosmani/web-quality-skills |
| **supabase-postgres-best-practices** | Postgres / Supabase | supabase/agent-skills |
| **tailwind-css-patterns** | Tailwind utility-first | developer-kit |
| **typescript-advanced-types** | TypeScript | wshobson/agents |
| **vite** / **vitest** | Build y pruebas | antfu/skills |
| **zod** | Validación | pproenca/dot-skills |

Cada skill en `.cursor/skills/` incluye `ATTRIBUTION.md` cuando aplica. En `.agents/skills/`, ver licencias del repo de origen en `skills-lock.json`.