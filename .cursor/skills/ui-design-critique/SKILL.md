---
name: ui-design-critique
description: Audita páginas o componentes React y reporta problemas concretos de jerarquía, IA, usabilidad, responsive y conversión. Use when asked to critique UI, review a page, design review, or UX audit of a component.
license: MIT
---

Basado en marcos públicos de crítica de diseño (p. ej. kursku/skills `frontend/critique`, heurísticas de Nielsen). Adaptado para Ferretería Lozada.

**Primero:** lee `ferreteria-design-context`, `.cursor/cursor_rules`, `.cursor/ARCHITECTURE.md` y `.agents/skills/frontend-design` para anti‑patrones visuales.

## Cuándo ejecutar

El usuario señala un archivo, ruta (`/producto/...`, `/carrito`) o componente. Lee el código **y** piensa en el render móvil (≤390px) y desktop.

## Dimensiones de evaluación

### 1. Anti‑patrones “AI slop” (CRÍTICO)

¿Parece plantilla genérica de 2024–2025? Lista evidencias (paleta cliché, cards idénticas, gradientes decorativos, tipografía default).

### 2. Jerarquía visual y conversión

- ¿Se ve en 2 s qué hacer (buscar, elegir variante, agregar, cotizar)?
- ¿El CTA principal compite con elementos secundarios?
- En **ficha de producto:** nombre → foto → variante (medida/color) → precio → disponibilidad → carrito.

### 3. Arquitectura de información

- ¿Agrupa bien specs, usos y medidas?
- ¿Filtros del catálogo entendibles en móvil?
- ¿Sobrecarga de opciones (Hick) en un solo viewport?

### 4. Responsive móvil‑primero

- Scroll horizontal accidental, texto &lt;16px en inputs, targets &lt;44px.
- Imágenes con tamaño estable (CLS).
- Navegación: ¿el carrito y buscador son alcanzables con el pulgar?

### 5. Accesibilidad (muestra)

- Foco visible, contraste, nombres accesibles en iconos.
- Si hay hallazgos graves, indica skill `accessibility` para profundizar.

### 6. Microcopy y confianza

- ¿Claro para maestro de obra sin jerga innecesaria?
- Disponibilidad y precios sin ambigüedad.

### 7. Estados y bordes

- Vacío, carga, error, agotado, “consultar stock” — ¿guían el siguiente paso?

## Formato del informe (obligatorio)

Entrega en español ecuatoriano, directo:

### Veredicto anti‑patrones
Pass/Fail + lista corta.

### Impresión general
2–4 oraciones.

### Lo que funciona
2–3 puntos específicos con referencia al archivo/componente.

### Problemas prioritarios (máx. 5)

Por cada uno:
- **Qué** (componente o zona)
- **Por qué importa** (usuario en obra / conversión)
- **Arreglo concreto** (Tailwind/React, sin vaguedades)
- **Skill sugerida** (`frontend-design`, `mobile-first-responsive`, `commerce-product-pages`, `ux-writing`, `web-design-guidelines`, `accessibility`)

### Observaciones menores

### Preguntas para desbloquear
1–3 preguntas si falta contexto de negocio.

**Reglas:** nombra archivos y líneas cuando sea posible; prioriza impacto en venta y uso en celular; no suavices críticas.