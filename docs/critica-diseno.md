# Crítica de diseño — Ferretería Lozada (sitio público)

Auditoría mobile-first (≈390px) y escritorio (≈1440px) con las skills del repo (`ui-design-critique`, `mobile-first-responsive`, `commerce-product-pages`, `web-design-guidelines`, `ferreteria-design-context` + `.agents/skills/accessibility`).

**Audiencia:** Joshua y equipo sin formación en diseño.  
**Fecha:** noviembre 2026.

## Resumen en corto

La tienda **sí vende** cuando el catálogo carga: buenas fotos, precio visible, botón “Agregar”. El problema fuerte en móvil era el **bloque de categorías**: buscador + doble fila de pastillas horizontales comían la pantalla antes de los productos, se veían recortadas y competían con el buscador principal. En este PR se reemplazó por **un solo botón** que abre un **panel desde abajo** (mismo árbol que en escritorio) y se metieron “Solo ofertas / Más vendidos” dentro de **Filtros** en móvil para bajar ruido.

Siguen temas mayores (no tocados o solo documentados): WhatsApp flotante tapa contenido, cabecera de catálogo muy larga, variantes en ficha de producto, y peso del JS inicial.

---

## Inicio (`/`)

| Qué pasa | Por qué duele | Estado |
| --- | --- | --- |
| El buscador grande está bien ubicado | Encaja con “¿Qué necesitas para tu obra?” | OK |
| Mucho scroll hasta productos en móvil | Hero + buscador + promos antes de ofertas | **Propuesta:** acortar hero móvil o ancla “Ver ofertas” |
| Tarjetas de producto legibles | Precio y nombre claros | OK |

---

## Catálogo (`/catalogo`)

| Qué pasaba (antes) | Por qué duele en ventas | Qué hicimos |
| --- | --- | --- |
| Buscador de categoría + pastillas horizontales (2 filas) | El maestro no ve productos sin hacer mucho scroll; confunde “buscar categoría” vs “buscar producto” | Botón **Categoría: …** + panel inferior con árbol, chevrones y subcategorías (como sidebar) |
| Placeholder del buscador truncado (“…códi”) | Parece roto, menos confianza | Texto más corto: “Buscar producto, medida o código”; input `text-base` (16px) |
| Tres botones de fila (Filtros + ofertas + más vendidos) | Apretados en pantallas chicas | En móvil: ofertas/más vendidos **dentro** del sheet de Filtros |
| Productos desde ~mitad de pantalla | Menos impresiones por visita | Mejor con el nuevo control de categoría |

| Pendiente | Impacto |
| --- | --- |
| Título + párrafo + breadcrumbs siempre arriba | Sigue ocupando espacio; considerar título más corto en móvil | Medio |
| Contador “24 de 1248” lejos del grid | Poco crítico | Bajo |
| WhatsApp flotante sobre la 2.ª columna de cards | Tap accidental, tapa foto | **Alto** — subir margen inferior del grid o bajar z-index con safe-area |

**Capturas:** `docs/critica/catalogo-mobile-antes.png` (producción anterior) vs panel en preview del PR.

---

## Ficha de producto (`/producto/...`)

| Qué pasa | Por qué duele | Estado |
| --- | --- | --- |
| Imagen y precio visibles | Bien para decisión rápida | OK |
| Variantes (medida, color, etc.) | Si hay muchas, hace falta jerarquía clara | Revisar chips vs selects en móvil |
| Uso / descripción técnica | Ayuda a vender a quien no conoce el ítem | Depende del copy importado del Excel |

**Propuesta:** bloque fijo “Para qué sirve” + tabla de medidas siempre bajo el precio en móvil.

---

## Carrito (`/carrito`) y cotización (`/carrito/cotizar`)

| Qué pasa | Por qué duele | Estado |
| --- | --- | --- |
| Mensaje claro si está vacío | Guía al catálogo | OK |
| Flujo solo nombre → PDF/WhatsApp | Correcto para el negocio | OK |
| Cotizar con carrito vacío | Debe redirigir o avisar | Verificar en QA |

---

## Promociones y Nosotros

| Qué pasa | Nota |
| --- | --- |
| Promociones fuera del carrito | Coherente con negocio | OK |
| Nosotros con mapa y horarios | Confianza local | OK; mapa puede pesar en móvil |

---

## Cabecera, menú y WhatsApp

| Qué pasa | Por qué duele | Propuesta |
| --- | --- | --- |
| Carrito + menú hamburguesa | Patrón conocido | OK |
| Botón WhatsApp verde flotante | Siempre visible, pero tapa cards y enlaces del pie | `bottom: env(safe-area)` + colapsar al scroll, o barra inferior “Cotizar / WhatsApp” |
| Menú móvil sin enlace directo a categorías | Ahora el catálogo compensa con el panel | Aceptable |

---

## Accesibilidad (muestra)

| Tema | Estado |
| --- | --- |
| Panel categorías: foco, Escape, cierre, `aria-modal` | **Implementado** en `BottomSheet` |
| Panel Filtros: ya tenía backdrop móvil | Mejorar foco igual que categorías — **propuesta** |
| Contraste marca #F23005 | Vigilar en fondos claros |
| `prefers-reduced-motion` | Animación del sheet respeta reducción global en CSS |

---

## Cambios incluidos en este PR (código)

1. `BottomSheet` reutilizable con trampa de foco y bloqueo de scroll.
2. `CategoryNav` móvil: botón compacto + panel inferior con buscador y árbol.
3. `Filters`: destacados dentro del sheet en móvil; chips en `lg+`.
4. `SearchBar`: placeholder y tamaño de texto en móvil.
5. `Catalog.tsx`: espaciado mobile-first.

---

## Propuestas mayores para que Joshua apruebe

1. **Barra de acción inferior en móvil** (Catálogo / Ficha / Carrito): “Buscar · Categoría · Carrito · WhatsApp”.
2. **WhatsApp:** dejar de flotar sobre el grid; anclar al borde con margen o integrar al pie sticky.
3. **Ficha:** sección “Especificaciones” siempre visible (acordeón si hace falta).
4. **Rendimiento:** reducir chunk principal (>500 KB) para INP en celulares de obra.
5. **Unificar sheets:** categorías y filtros en un solo “Refinar catálogo” con pestañas (Categoría | Filtros).

---

## Cómo ver las capturas

| Archivo | Contenido |
| --- | --- |
| `docs/critica/catalogo-mobile-antes.png` | Producción antes del panel (pastillas) |
| `docs/critica/catalogo-mobile-despues.png` | Preview del PR con botón + sheet |
| `docs/critica/catalogo-mobile-categorias-sheet.png` | Panel de categorías abierto |

Más capturas en el cuerpo del PR (home, producto, carrito, escritorio).