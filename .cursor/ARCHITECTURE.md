# ARCHITECTURE — Ferretería Lozada

## Visión General

Plataforma web comercial para **aumentar ventas** de Ferretería Lozada. Catálogo moderno + carrito + cotizaciones por WhatsApp, sin pago online. Dirección: ayudar al maestro de obra a encontrar su producto desde el celular en el menor número de clics y convertir eso en un WhatsApp.

Públicos objetivo: maestros de obra, metalmecánica, cerrajeros, carpinteros, contratistas, constructoras y consumidor final. **Mobile-first**. Sin artificio. Ferretería de barrio confiable + proveedor profesional.

---

## Decisiones de Arquitectura

### 1. Base de datos: Supabase (PostgreSQL) vs Firebase

**Elegido: Supabase**

Razones:
- Relaciones claras (products → variants, categories → subcategories, orders → order_items) = PostgreSQL relacional, no documents de Firestore.
- RLS (Row Level Security) nativo, mejor que Firebase Rules para control granular (lectura pública catálogo, escritura solo admin).
- Full-text search con trigram (pg_trgm) → búsqueda rápida de "tornillo 6x2" sin servicios terceros.
- Edge Functions Deno para validación de cotizaciones sin exponer service role key.
- Storage integrado (product-images, quotes).
- Free tier generoso: Supabase Free ≥ Firebase Spark.

### 2. Frontend: React + Vite + TypeScript

**Elegido: React 19 + Vite + TypeScript**

Razones:
- Vite: build rápido, dev server instantáneo (crítico para prototipado iterativo con Cursor).
- TypeScript: Supabase genera tipos del esquema automáticamente → cero errores de "columna no existe".
- React: familiar, componentes reutilizables, estado centralizable (CartProvider, AuthProvider).
- Routing: React Router v6 (cambió de Next.js porque Vercel static export + dynamic API es más complejo que Vite + Supabase).

### 3. Estilos: Tailwind CSS (único)

**Elegido: Tailwind CSS**

Razones:
- Atomic CSS: colors, spacing, fonts definidos UNA VEZ en `tailwind.config.js`, nunca hardcodeados.
- Pequeño bundle (purga CSS no usado).
- Responsive móvil-first por defecto (clases `md:`, `lg:`).
- Pre-built UI componentes genéricos reutilizables.

**NO hay Bootstrap, Material-UI ni otra librería de CSS.** Causa conflictos y duplica selectores.

### 4. Animaciones: Lenis + GSAP

**Elegido: Lenis + GSAP + ScrollTrigger**

Razones:
- Lenis: smooth scroll global sin CLS (Cumulative Layout Shift), respeta `prefers-reduced-motion`.
- GSAP: aparición de tarjetas al scroll (ScrollTrigger), transiciones entre vistas, marquee del Home.
- Sin dependencias de librerías de carrusel (custom Marquee en GSAP es más ligero).
- Referencia visual: formani.com/products/Catalogue (suave, moderno, sin spam de animación).

### 5. PDF: pdf-lib (servidor, no cliente)

**Elegido: pdf-lib en Edge Function**

Razones:
- Funciona en Deno (Edge Functions), no en DOM.
- Genera PDF en servidor (service role valida precios) → cliente no puede manipular total.
- Sin dependencias de HTML-to-PDF complejas (wkhtmltopdf, puppeteer).
- PDF incluye código de producto, variante, cantidad, precio unitario, subtotal, total, vigencia 15 días.

### 6. Búsqueda: PostgreSQL trigram (pg_trgm)

**Elegido: PostgreSQL full-text con trigram**

Razones:
- Índice GIN en `products.name` hace que "tornillo 6x2" sea rápido sin Elasticsearch.
- Busca en variantes (size, barcode) con JOIN sencillo.
- Query simple: `products WHERE name ILIKE '%busca%'` + trigram similarity ranking.
- Gratis en Supabase, no hay API externa de búsqueda que pagar.

### 7. Carrito: Persistencia en sessionStorage, NOT localStorage

**Elegido: sessionStorage + React Context**

Razones:
- sessionStorage: borrado al cerrar pestaña (cotizaciones no son persistentes entre sesiones por seguridad).
- localStorage: expondría carrito a cambios con DevTools (editar cantidad = atacar total).
- React Context (CartProvider): estado limpio, fácil de testear (lógica en `cart.ts` pura).
- Lógica de carrito separada de UI (`cart.ts` contiene funciones puras: add, remove, qty, grouping).

### 8. RLS: Función SECURITY DEFINER vs políticas recursivas

**Elegido: Función public.is_admin() SECURITY DEFINER**

Razones:
- Problema original: `auth.uid() IN (SELECT id FROM admins)` dentro de políticas de admins = recursión infinita (RLS se aplica sobre la subquery).
- Solución: `public.is_admin()` función con `SECURITY DEFINER SET search_path = ''` que salta RLS, retorna boolean.
- Políticas usan `(SELECT public.is_admin())` en lugar de subquery → sin recursión.
- Migracion 0001 implementa esto.

### 9. Cotizaciones: Edge Function vs base de datos triggers

**Elegido: Edge Function**

Razones:
- Edge Function valida cada `variant_id`, obtiene el precio real de BD y recalcula total (cliente no puede editar).
- Genera PDF en servidor (con service role) → firma PDF con fecha/número de cotización antes de guardarlo.
- Inserta en `orders`/`order_items` en una transacción única.
- No hay forma de que el cliente haga INSERT directo en orders (RLS + Edge Function bloquean).

### 10. Importación de catálogo: JSON + upsert, no CSV directo

**Elegido: JSON normalizador → upsert en Supabase**

Razones:
- Normalizador (Streamlit, paralelo) agrupa 2.900 filas en familias + variantes, produce JSON.
- JSON incluye `origin_id` (ID del sistema de facturación) para identificar duplicados.
- Upsert en dos pasadas: categories (por slug) → products (por origin_id) → variants (por origin_id).
- Nunca se usa barcode como llave (puede repetirse en el Excel real).

---

## Modelo de datos

### Entidades

```
products (familia)
  ├─ id uuid PK
  ├─ origin_id int UNIQUE         (ID del sistema de facturación)
  ├─ name text                    (ej. "Tornillo para madera")
  ├─ description text             (opcional)
  ├─ category_id uuid FK          (fijaciones/tornillos)
  ├─ is_offer bool                (true = aparece en Home ofertas)
  ├─ is_bestseller bool            (true = aparece en Home más vendidos)
  └─ created_at, updated_at

product_variants (medida/color/presentación/forma de venta)
  ├─ id uuid PK
  ├─ product_id uuid FK           (← products)
  ├─ origin_id int UNIQUE         (ID del sistema, para esta fila del Excel)
  ├─ size text                    (ej. "6x2", "1 1/2\"")
  ├─ color text                   (ej. "blanco", solo si pintura/esmalte)
  ├─ presentation text            (ej. "galón", "litro", "ciento")
  ├─ sale_unit text               (ej. "unidad", "ciento")
  ├─ price numeric(10,2)          (incluye IVA, venta al público)
  ├─ barcode text                 (informativo, NO llave — puede repetirse)
  ├─ availability text            ("disponible" | "agotado" | "consultar")
  └─ created_at, updated_at

categories (con subcategorías)
  ├─ id uuid PK
  ├─ name text                    (ej. "Fijaciones")
  ├─ slug text UNIQUE             (ej. "fijaciones")
  ├─ parent_id uuid FK self       (null si es categoría principal)
  ├─ sort_order int               (ordenamiento visual)
  └─ created_at

product_images
  ├─ id uuid PK
  ├─ product_id uuid FK           (← products)
  ├─ variant_id uuid FK           (← product_variants, opcional si color distinto)
  ├─ url text                     (almacenado en Supabase Storage)
  ├─ is_primary bool              (true = se muestra en tarjeta del catálogo)
  └─ sort_order int

promotions (combos temporales, independientes del catálogo)
  ├─ id uuid PK
  ├─ title text
  ├─ description text             (opcional)
  ├─ price_label text             (texto libre: "$45", "2x1" — no es precio de inventario)
  ├─ image_url text
  ├─ start_date date              (default: hoy en America/Guayaquil)
  ├─ end_date date                (vigente mientras hoy ≤ end_date)
  └─ created_at, updated_at

orders (cotizaciones)
  ├─ id uuid PK
  ├─ quote_number text UNIQUE     (ej. "COT-000001")
  ├─ client_name text             (ej. "Juan García")
  ├─ total numeric(10,2)          (recalculado en Edge Function, validado)
  ├─ pdf_url text                 (URL de PDF guardado en Storage/quotes)
  ├─ created_at
  └─ valid_until date             (CURRENT_DATE + 15 days, borrado automático por pg_cron)

order_items (líneas de cada cotización)
  ├─ id uuid PK
  ├─ order_id uuid FK             (← orders, ON DELETE CASCADE)
  ├─ variant_id uuid FK           (← product_variants, ON DELETE SET NULL — cotización sobrevive al borrado)
  ├─ product_name text            (copia del nombre al momento del pedido, por si el producto cambia después)
  ├─ variant_label text           (ej. "6x2, Ciento")
  ├─ quantity numeric             (50)
  ├─ unit_price numeric(10,2)     ($0.015 al momento del pedido)
  └─ subtotal numeric(10,2)       (quantity * unit_price)

site_settings (config editable)
  ├─ key text PK                  (ej. "whatsapp_number")
  └─ value jsonb                  ({"number": "+593995307272", "business": true})

admins (usuarios administrativos)
  ├─ id uuid PK FK auth.users     (vinculado a usuario de Supabase Auth)
  ├─ name text                    (ej. "Papá")
  └─ created_at

rate_limits (control de abuso en Edge Function)
  ├─ ip_hash text PK              (hash de IP del cliente)
  ├─ window_start timestamptz     (inicio de la ventana de 1 minuto)
  └─ count int                    (requests en esa ventana)
```

### Índices

```
products:
  ├─ idx_products_category (category_id)         — filtro por categoría rápido
  └─ idx_products_name_trgm (GIN trgm de name)   — búsqueda "tornillo" rápida

product_variants:
  ├─ idx_variants_product (product_id)           — lista de variantes de un producto
  └─ idx_variants_barcode (barcode)              — búsqueda por código

categories:
  └─ idx_categories_parent (parent_id)           — subcategorías de una categoría

order_items:
  └─ idx_order_items_order (order_id)            — líneas de una cotización

promotions:
  └─ idx_promotions_dates (start_date, end_date) — Home y panel filtran por vigencia
```

### Row Level Security (RLS)

```
Tabla                   Políticas
─────────────────────────────────────────────────────────
categories              → anon + authenticated: SELECT (lectura pública)
                        → authenticated + admin: ALL (edición solo admin)

products                → anon + authenticated: SELECT
                        → authenticated + admin: ALL

product_variants        → anon + authenticated: SELECT
                        → authenticated + admin: ALL

product_images          → anon + authenticated: SELECT
                        → authenticated + admin: ALL

promotions              → anon + authenticated: SELECT
                        → authenticated + admin: ALL

site_settings           → anon + authenticated: SELECT
                        → authenticated + admin: ALL (edición solo admin)

orders                  → public: INSERT (crear cotización, sin validación RLS)
                        → authenticated + admin: SELECT, DELETE (ver historial + borrar)

order_items             → public: INSERT
                        → authenticated + admin: SELECT

admins                  → authenticated + admin: SELECT (solo admin ve lista de admin)

auth.users              (no tocado, lo maneja Supabase Auth)
```

---

## Rutas públicas

```
/ ...................... Home
/catalogo .............. Catálogo paginado
/catalogo/:slug ........ Categoría
/producto/:originId .... Ficha de producto
/promociones ........... Combos vigentes (página dedicada)
/carrito ............... Carrito
/carrito/cotizar ....... Cotización + WhatsApp
/nosotros .............. Sobre nosotros
```

## Flujos principales

### 1. Ver catálogo

```
Usuario (navegador)
  ↓ GET / (Home)
  → Fetch categories (lectura pública, RLS permite)
  → Fetch products (paginados, 24 por página) + variantes + imagen primaria
  → Render Home (hero, buscador, promociones vigentes si hay, ofertas, más vendidos)
  ↓ Click "Ver catálogo" o "Buscar"
  → GET /catalogo?q=tornillo
  → Fetch products con name ILIKE '%tornillo%' (trigram, rápido)
  → Render ProductGrid (tarjetas con precio mínimo, disponibilidad)
  ↓ Click en tarjeta
  → GET /producto/1855 (origin_id)
  → Fetch product + todas sus variantes
  → Render VariantSelector (medida, color, presentación, forma de venta)
  ↓ Selecciona variante
  → Muestra precio, disponibilidad, botón "Añadir al carrito"
```

### 2. Carrito

```
Usuario
  ↓ Click "Añadir al carrito"
  → CartProvider.add(productId, variantId, quantity)
  → sessionStorage.setItem('cart', JSON)
  → CartBadge.tsx muestra contador con microanimación
  ↓ Click en carrito (icono superior)
  → GET /carrito
  → Render CartPage (líneas editables, aumentar/disminuir, eliminar)
  ↓ Click "Cotizar"
  → Pedir nombre del cliente (validar con Zod, sanitizar)
  → POST /api/quote (Edge Function)
  → Edge Function:
      1. rate_limit(ip_hash) — ¿ya hizo 10 requests en 1 min?
      2. Validar items (zod schema)
      3. Para cada variant_id: SELECT price real de BD
      4. Recalcular total (ignora total del cliente)
      5. INSERT orders (genera quote_number)
      6. INSERT order_items (con product_name, variant_label, precios reales)
      7. Generar PDF (pdf-lib, incluye logo, datos, productos, total)
      8. Subir PDF a Storage/quotes
      9. UPDATE orders SET pdf_url
  ← Retorna quote_number + PDF (base64 o URL)
  → QuoteFlow.tsx: muestra botón "Descargar PDF" + botón "Abrir WhatsApp"
  ↓ Click "Abrir WhatsApp"
  → buildMessage(items, total) = mensaje sin código de producto
  → window.open('https://wa.me/+593995307272?text=...')
```

### 3. Panel admin

```
Usuario admin (papá/mamá/Joshua) logueado con Supabase Auth
  ↓ GET /admin
  → RequireAdmin: verifica auth.user() + tabla admins
  → Render AdminDashboard (menú: productos, categorías, imágenes, ajustes, etc.)
  
  ↓ Subpath /admin/productos
  → Fetch products + variantes (admin puede ver todo)
  → Tabla editable: nombre, categoría, precio, disponibilidad, is_offer, is_bestseller
  → Click en producto:
      1. Editar nombre, descripción, categoría
      2. Editar variantes: medida, precio, disponibilidad
      3. Subir imagen (múltiples): producto o variante específica
  → El UPDATE es directo a Supabase (RLS permite porque user está en admins)
  
  ↓ Subpath /admin/promociones
  → Lista activas (end_date ≥ hoy Quito) y pestaña Expiradas (archivo, no se borran solas)
  → Formulario: título, descripción, price_label (texto), imagen (archivo o URL), fecha de fin
  → Atajos +3/+7/+15/+30 días; Reactivar reabre el form con una fecha nueva
  → No toca products ni el carrito
  
  ↓ Subpath /admin/ajustes
  → Fetch site_settings
  → Tabla editable: whatsapp_number, address, schedule (JSON), home_hero_text, about_history, etc.
  → El UPDATE serializa a JSON y guarda en site_settings.value
  
  ↓ Subpath /admin/cotizaciones
  → Fetch orders (admin puede ver todas)
  → Tabla: quote_number, client_name, fecha, total, botón "Ver PDF"
  → Botón "Ver PDF": fetch URL firmada del Storage (válida 1 hora) + muestra en modal o descarga
  → Los orders se borran automáticamente a los 15 días (pg_cron, no manual)
  
  ↓ Subpath /admin/importar
  → Input file o textarea con JSON del normalizador
  → Validar con Zod (categories[], products[origin_id, name, variants[]], etc.)
  → Upsert en dos pasadas:
      1. categories: upsert por slug
      2. products: upsert por origin_id
      3. variants: upsert por origin_id
  → Mostrar resumen: "123 productos importados, 45 actualizados, 2 con advertencia"
```

---

## Fases de desarrollo

### Fase 0: Migraciones correctivas

**Estado: ✅ APLICADAS EN SUPABASE + ARCHIVOS EN REPO**

Carpeta: `supabase/migrations/` (versiones con timestamp, ya aplicadas en el proyecto `qepfvvfuhbthzmwbfvos`):

1. `20260930030402_fix_admin_rls_recursion.sql` — `is_admin()` SECURITY DEFINER + políticas sin recursión
2. `20260930030427_indexes_and_updated_at_triggers.sql` — índices FK + `touch_updated_at`
3. `20260930030440_cron_purge_expired_quotes.sql` — `pg_cron` + `purge_expired_quotes`
4. `20260930030457_storage_buckets_product_images_and_quotes.sql` — buckets product-images / quotes
5. `20260930030530_seed_site_settings.sql` — valores por defecto del sitio
6. `20260930030552_rate_limits_for_edge_functions.sql` — tabla + `check_rate_limit`
7. `20260930030600_move_pg_trgm_out_of_public.sql`
8. `20260930030657_revoke_is_admin_from_anon.sql`
9. `20260930031211_search_product_ids_function.sql`
10. `20260930032416_widen_price_precision_to_four_decimals.sql`
11. `20260930033420_revoke_public_order_insert.sql` — inserts de orders solo vía Edge Function

No volver a aplicar a mano si ya constan en `supabase_migrations.schema_migrations`.

### Fase 1: Catálogo de solo lectura

**Estado: ✅ EN PRODUCCIÓN LOCAL**

Componentes:
- Home (hero, cinta, ofertas, más vendidos)
- Catálogo (grid paginado, filtros por categoría)
- Ficha de producto (variantes, disponibilidad, botón carrito)
- Búsqueda (trigram rápido)
- Promociones (`/promociones` + sección en Home si hay vigentes)

Hooks:
- `useSettings()` — leer site_settings (whatsapp, horarios, textos)
- `useReducedMotion()` — respetar preferencia del usuario

### Fase 2: Carrito

**Estado: ✅ BASICAMENTE LISTO**

- CartProvider + sessionStorage
- Lógica pura en `cart.ts`
- Microanimación del badge al añadir
- Edición de cantidad/variante/eliminar línea
- Captura de nombre del cliente (validado)

### Fase 3: Edge Function create-quote + PDF + WhatsApp

**Estado: ✅ IMPLEMENTADA**

- `supabase/functions/create-quote/index.ts` — Zod + rate limit + precios reales + orders/items + PDF
- `supabase/functions/create-quote/pdf.ts` — pdf-lib (logo, líneas, total, vigencia)
- Frontend: `src/data/orders.ts` (`createQuote`) + `/carrito/cotizar` (`Quote.tsx`)
- WhatsApp: `QuoteResultPanel` + `buildMessage`

### Fase 4: Panel admin

**Estado: ✅ CÓDIGO COMPLETO (falta probar contra la base real: RLS, buckets, PDF firmado)**

Rutas: `/admin/login`, `/admin`, `/admin/productos[/nuevo|/:id]`, `/admin/categorias`, `/admin/promociones`, `/admin/ajustes`, `/admin/cotizaciones`, `/admin/importar`. Estadísticas viven en `/admin` (Dashboard).

Componentes:
- RequireAdmin (wrapper para rutas admin)
- AdminDashboard (índice)
- ProductsAdmin (tabla CRUD)
- CategoriesAdmin
- ImagesAdmin (upload a Storage)
- SettingsAdmin (JSON editable)
- QuotesAdmin (historial, PDF)
- StatsAdmin (gráficos simples)

Lógica:
- Supabase Auth login
- Verificación de tabla admins
- CRUD directo a Supabase (RLS protege)

### Fase 4.5: Combos y promociones

**Estado: ✅ IMPLEMENTADA**

- Tabla `promotions` (migración `20261001015536_promotions.sql`), independiente del catálogo
- Home: sección **Promociones** después del buscador y antes de Ofertas; solo si hay vigentes (`start_date ≤ hoy ≤ end_date`, calendario de Quito). Botón **Ver más** a `/promociones`
- Página pública `/promociones`: todas las vigentes; si no hay ninguna, mensaje vacío (la página sí existe)
- Card: imagen, título, `price_label`, badge de días, **Solicitar combo** (WhatsApp con texto) y aviso de acercarse con la imagen
- Admin `/admin/promociones`: activas / expiradas (archivo), crear/editar, imagen archivo o URL, atajos de fecha, reactivar
- Datos: `src/data/promotions.ts` (público) y `src/data/adminPromotions.ts` (CRUD)

### Fase 5: Importador JSON

**Estado: ✅ IMPLEMENTADA**

- Ruta: `/admin/importar` (`AdminImport.tsx`)
- Datos: `src/data/adminImport.ts` — parse Zod + upsert categories (slug) → products (`origin_id`) → variants (`origin_id`)
- Schemas: `catalogImportSchema` en `lib/validation.ts`
- Resumen: creados/actualizados + advertencias (categoría faltante, variante sin `origin_id`, etc.)

### Fase 6: Animaciones + SEO + accesibilidad + performance

**Estado: ✅ IMPLEMENTADA (sin deploy)**

Animaciones (`src/animation/`):
- Lenis smooth scroll en la tienda pública (`LenisProvider`)
- GSAP + ScrollTrigger en `[data-reveal]` (tarjetas, pasos, CTA)
- Sin marquee en Home: se quitó “Lo que más se mueve” (duplicaba Más vendidos)
- `prefers-reduced-motion` apaga Lenis y GSAP

SEO:
- Meta tags por página (`useDocumentMeta`) + og/twitter
- JSON-LD `HardwareStore` en Home
- `public/robots.txt` + `public/sitemap.xml` (actualizar dominio al desplegar)
- URLs amigables (category slug, product origin_id)

Accesibilidad (base ya cubierta + revisada):
- Contraste AA (botones brand-700), labels, focus visible, alt, targets ≥44px
- Skip link, mensajes de error claros

Performance:
- Imágenes lazy (excepto LCP: hero + primeras 4 tarjetas)
- Manual chunks Vite (`animation`, `supabase`) + React.lazy del admin
- CSS/JS minificado por Vite

Home UX (ajuste Fase 6):
- Una sola barra de búsqueda: “¿Qué necesitas para tu obra?”
- Buscador del header eliminado; el catálogo tiene el suyo
- Secciones de productos: solo **Ofertas** y **Más vendidos**

### Fase 7: Despliegue

**Estado: 📋 CUANDO ESTÉ LISTO**

1. Crear cuenta Vercel
2. Conectar repositorio GitHub
3. Configurar env vars en dashboard Vercel:
   - VITE_SUPABASE_URL
   - VITE_SUPABASE_ANON_KEY
4. Deploy automático en push a `main`
5. Después: dominio + Cloudflare (DNS + CDN)

---

## Decisiones pendientes de ti

1. **TypeScript**: ¿sí o mejor JavaScript?
   → Recomendación: **Sí**, Supabase genera tipos.

2. **URL de producto**: `/producto/1855` vs `/producto/tornillo-para-madera`
   → Recomendación: `/producto/1855` ahora (sencillo), migrar a slug después si necesitas SEO extra.

3. **Búsqueda por marca**: ¿agregar columna brand?
   → Recomendación: Busca dentro de name/description por ahora, agregar brand si lo necesitas.

4. **Categorías buscadas**: ¿registrar en log o solo "productos más solicitados"?
   → Recomendación: Solo productos por ahora (sale de order_items), agregar log de búsquedas si necesitas.

5. **Cuentas admin**: 3 correos (papá, mamá, Joshua) para crear en Supabase Auth.

6. **Foto real + Logo**: necesito para hero y PDF.

7. **Hosting final**: Vercel ¿confirmado?

---

## Debugging rápido

```bash
# Terminal — estado del proyecto
supabase status

# Supabase CLI
supabase migration new <nombre>  # crear migración
supabase db push                  # aplicar migraciones
supabase functions deploy         # deployar Edge Functions

# Frontend local
npm run dev                       # Vite dev server
npm run build                     # build estático
npm run preview                   # preview del build

# Base de datos — SQL Editor de Supabase
SELECT * FROM products LIMIT 5;
SELECT COUNT(*) FROM order_items;
SELECT * FROM site_settings;
```

---

## Referencia rápida: URLs clave

- **Supabase Dashboard**: https://app.supabase.com/ (tu proyecto)
- **GitHub**: https://github.com/Scorpwik/tienda-ferreteria-lozada
- **Local frontend**: http://localhost:5173
- **Local Supabase** (si usas `supabase start`): http://localhost:54321

---

## Stack resumido

| Capa | Tecnología | Propósito |
|------|-----------|----------|
| Frontend | React 19 + Vite + TS | UI + lógica cliente |
| Estilos | Tailwind CSS | CSS atomic |
| Animaciones | Lenis + GSAP | Scroll + transiciones |
| Base de datos | Supabase (PostgreSQL 17.6) | Persistencia + RLS |
| Autenticación | Supabase Auth | Login admin |
| Backend | Edge Functions (Deno) | Validación + PDF + cotizaciones |
| Storage | Supabase Storage | Imágenes + PDFs |
| Búsqueda | PostgreSQL trigram | Full-text rápido |
| PDF | pdf-lib (servidor) | Generación segura |
| Despliegue | Vercel + Supabase | Hosting final |
| Costo | $0/mes | Free tier |
