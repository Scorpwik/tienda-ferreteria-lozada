# Crítica de diseño — Ferretería Lozada (sitio público)

Auditoría mobile-first (≈390px) y escritorio (≈1440px) con las skills del repo (`ui-design-critique`, `mobile-first-responsive`, `commerce-product-pages`, `web-design-guidelines`, `ferreteria-design-context` + `.agents/skills/accessibility`).

**Audiencia:** Joshua y equipo sin formación en diseño.  
**Fecha:** noviembre 2026.

## Resumen en corto

La tienda **sí vende** cuando el catálogo carga: buenas fotos, precio visible, botón “Agregar”. En móvil se corrigió el **bloque de categorías** (panel inferior), se compactó la **cabecera del catálogo**, el **WhatsApp flotante** deja de tapar el grid al hacer scroll, y el **JS inicial** baja con rutas en lazy load + carga diferida de Lenis/GSAP. Quedan propuestas grandes (barra inferior unificada, specs con tabla importada, un solo sheet “Refinar”).

---

## Inicio (`/`)

| Qué pasa | Por qué duele | Estado |
| --- | --- | --- |
| El buscador grande está bien ubicado | Encaja con “¿Qué necesitas para tu obra?” | OK |
| Mucho scroll hasta productos en móvil | Hero + buscador + promos antes de ofertas | **Parcial:** hero móvil más bajo (`pt-8`); falta ancla “Ver ofertas” |
| Tarjetas de producto legibles | Precio y nombre claros | OK |

---

## Catálogo (`/catalogo`)

| Qué pasaba (antes) | Por qué duele en ventas | Qué hicimos |
| --- | --- | --- |
| Buscador de categoría + pastillas horizontales (2 filas) | El maestro no ve productos sin hacer mucho scroll | Botón **Categoría: …** + `BottomSheet` con árbol |
| Placeholder del buscador truncado | Parece roto | Placeholder corto + `text-base` |
| Tres botones de fila (Filtros + ofertas + más vendidos) | Apretados | Ofertas/más vendidos dentro del sheet de Filtros en móvil |
| Título largo + párrafo siempre visible | Come altura antes del grid | Título **Catálogo** / **Búsqueda: …**, párrafo solo `sm+`, menos padding |
| WhatsApp flotante sobre cards | Tap accidental, tapa foto | FAB más pequeño, `z-40`, safe-area, **oculto al bajar** scroll; `main` con padding inferior en móvil |

| Pendiente | Impacto |
| --- | --- |
| Contador “24 de 1248” lejos del grid | Bajo |
| Unificar categorías + filtros en un sheet con pestañas | Medio — propuesta mayor |

**Capturas:** `docs/critica/catalogo-mobile-antes.png` vs `catalogo-mobile-despues.png`.

---

## Ficha de producto (`/producto/...`)

| Qué pasa | Por qué duele | Estado |
| --- | --- | --- |
| Imagen y precio visibles | Bien para decisión rápida | OK |
| Variantes (medida, color, etc.) | Si hay muchas, hace falta jerarquía clara | Revisar chips vs selects en móvil |
| Uso / descripción técnica | Ayuda a vender | **Hecho:** bloque **“Para qué sirve”** bajo el precio (copy del catálogo) |
| Tabla de medidas importada | Datos del Excel | **Pendiente** — hace falta modelo de datos / import |

---

## Carrito (`/carrito`) y cotización (`/carrito/cotizar`)

| Qué pasa | Por qué duele | Estado |
| --- | --- | --- |
| Mensaje claro si está vacío | Guía al catálogo | OK |
| Flujo solo nombre → PDF/WhatsApp | Correcto para el negocio | OK |
| Cotizar con carrito vacío | Debe redirigir | **OK** — `Navigate` a `/carrito` si el carrito está vacío |

---

## Promociones y Nosotros

| Qué pasa | Nota |
| --- | --- |
| Promociones fuera del carrito | Coherente con negocio | OK |
| Nosotros con mapa y horarios | Confianza local | OK; mapa puede pesar en móvil |

---

## Cabecera, menú y WhatsApp

| Qué pasa | Estado |
| --- | --- |
| Carrito + menú hamburguesa | OK |
| Botón WhatsApp verde flotante | **Hecho:** colapsa al scroll hacia abajo, vuelve al subir; tamaño menor en móvil |
| Menú móvil sin enlace directo a categorías | Aceptable (panel en catálogo) |

---

## Accesibilidad (muestra)

| Tema | Estado |
| --- | --- |
| Panel categorías: foco, Escape, `aria-modal` | **Implementado** (`BottomSheet`) |
| Panel Filtros móvil | **Implementado** — mismo `BottomSheet` + trampa de foco |
| Contraste marca #F23005 | Vigilar en fondos claros |
| `prefers-reduced-motion` | Sheet + transiciones respetan reducción |

---

## Rendimiento (JS)

| Medida | Estado |
| --- | --- |
| Rutas públicas en `React.lazy` | **Hecho** (`App.tsx`) |
| Lenis + reveals + transiciones | **Hecho** — chunk `PublicMotionShell` tras `requestIdleCallback` |
| GSAP en Home / transición desktop | **Hecho** — `import()` dinámico (no en el chunk inicial del shell) |
| Recharts (admin) | Ya en rutas admin lazy; sin cambio |
| Chunk principal | Mejor repartido; medir con `npm run build` tras cada cambio |

---

## Cambios incluidos en este PR (código)

1. `BottomSheet` + `CategoryNav` móvil.
2. `Filters`: destacados en sheet; **móvil usa `BottomSheet`** (misma a11y que categorías).
3. `SearchBar`, `Catalog.tsx`, `Category.tsx`: cabecera compacta en móvil.
4. `WhatsAppFloatingButton` + `useFabOnScroll` + padding en `main`.
5. `App.tsx`: lazy routes + `PublicMotionShell` diferido.
6. `Home.tsx`: hero más bajo en móvil; GSAP hero solo con import dinámico.
7. `Product.tsx`: sección **“Para qué sirve”**.

---

## Propuestas mayores (sin implementar — requieren decisión)

1. **Barra de acción inferior** (Catálogo / Ficha / Carrito): “Buscar · Categoría · Carrito · WhatsApp”.
2. **Ficha:** acordeón de especificaciones con datos estructurados del import.
3. **Unificar sheets:** un solo “Refinar catálogo” con pestañas (Categoría | Filtros).

---

## Cómo ver las capturas

| Archivo | Contenido |
| --- | --- |
| `docs/critica/catalogo-mobile-antes.png` | Producción antes del panel (pastillas) |
| `docs/critica/catalogo-mobile-despues.png` | Preview con botón + sheet |
| `docs/critica/catalogo-mobile-categorias-sheet.png` | Panel de categorías abierto |

Más capturas en el cuerpo del PR (home, producto, carrito, escritorio).