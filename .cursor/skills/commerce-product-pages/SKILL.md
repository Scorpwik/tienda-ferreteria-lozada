---
name: commerce-product-pages
description: Patrones UX para fichas de producto de ferretería — especificaciones, medidas, usos, variantes y conversión a carrito/cotización. Use when designing or reviewing Product pages, VariantSelector, ProductCard, or catalog detail.
license: MIT
---

Skill propia del repositorio, alineada con `.cursor/ARCHITECTURE.md` y datos Supabase (`products`, `product_variants`).

## Objetivo de negocio

En menos clics desde el celular, el visitante debe saber **qué es**, **para qué sirve**, **qué medida/color lleva** y **cuánto cuesta**, y poder **agregar al carrito** o seguir buscando.

## Jerarquía recomendada (ficha `/producto/:codigo`)

1. **Nombre del producto** (H1, una línea preferible en móvil).
2. **Imagen principal** (placeholder si falta; `alt` descriptivo).
3. **Selectores de variante** (orden fijo donde aplique):
   - Medida (`size`)
   - Color (`color`)
   - Presentación (`presentation`)
   - Unidad de venta (`sale_unit`)
4. **Precio** en USD, claro por la variante seleccionada.
5. **Disponibilidad** (`disponible` | `agotado` | `consultar`) — badge visible, no solo color.
6. **CTA primario:** agregar al carrito (deshabilitado o alternativa si agotado).
7. **Contenido de apoyo:**
   - Descripción orientada a **uso en obra** (no marketing vacío).
   - Tabla o lista de **especificaciones** (medidas numéricas, material, compatibilidad).
   - Código de producto / barcode solo si ayuda al cliente o al vendedor en WhatsApp (secundario visualmente).

## Copy y claridad

- Explica términos de ferretería la primera vez que aparezcan en la ficha si el público es mixto.
- Si una variante es la más vendida, resáltala sin ocultar las demás.
- Para `consultar`, ofrece camino claro (WhatsApp o nota de contacto desde settings).

## Tarjetas de catálogo (`ProductCard`)

- Foto, nombre corto, precio desde variante por defecto, badge oferta/más vendido si aplica.
- Toque en toda la tarjeta navega a ficha; botón de carrito rápido solo si no compite con la jerarquía.

## Búsqueda y filtros

- Resultados deben mostrar **medida** o variante relevante cuando la búsqueda fue por medida/código.
- Filtros en URL (compartibles); en móvil, panel de filtros no debe tapar el resultado sin forma de cerrar.

## Errores comunes a evitar

- Ocultar medida en un segundo tab en móvil.
- Mostrar precio sin variante seleccionada sin aviso.
- Variantes en dropdown ilegible en pantallas pequeñas (preferir chips/radios con buen target).
- Descripción genérica importada del Excel sin ajustar al lenguaje del maestro de obra.

## Verificación

Tras cambios, usa `ui-design-critique` en la ficha y `ux-writing` para etiquetas. Datos siempre desde `src/data/products.ts` y variantes — no inventar especificaciones.