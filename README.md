# Ferretería Lozada

Tienda en línea de **Ferretería Lozada**, el local familiar de Chillogallo, al sur de Quito, abierto desde 2002. El visitante busca el producto, arma su lista y recibe una cotización en PDF. El pago y la entrega se coordinan por WhatsApp.

El repositorio se llama `tienda-ferreteria-lozada`. Antes se llamaba `PaginaWebFerreteriaLozada`.

**Tienda en vivo:** [pagina-web-ferreteria-lozada.vercel.app](https://pagina-web-ferreteria-lozada.vercel.app)

---

## Qué incluye

### Tienda pública

- **Inicio** (`/`): portada con foto distinta para celular y computadora, buscador (“¿Qué necesitas para tu obra?”), promociones vigentes, ofertas, más vendidos, categorías y los pasos para pedir.
- **Catálogo** (`/catalogo`, `/catalogo/:categoria` y `/catalogo/:categoria/:subcategoria`): listado con “Cargar más”. Los filtros (búsqueda, disponibilidad, rango de precio, ofertas y más vendidos) viven en la URL, así que un enlace se puede compartir tal cual.
- **Ficha de producto** (`/producto/:codigo`): variantes de medida, color, presentación y forma de venta, precio en dólares, disponibilidad y botón para sumar al carrito. La URL usa el código del sistema de facturación y un sufijo con el nombre.
- **Búsqueda**: cada palabra puede caer en un campo distinto (nombre, descripción, etiquetas, categoría, código de origen, medida, color, presentación, unidad de venta o código de barras). Unifica tildes, pulgadas y colores parecidos. Hay un índice `pg_trgm` sobre la medida.
- **Carrito** (`/carrito`): se guarda en `sessionStorage`, permite cambiar cantidades y quitar líneas, anima la insignia al agregar y muestra sugerencias y promociones vigentes.
- **Cotización** (`/carrito/cotizar`): solo pide el nombre del cliente. La función en el servidor relee los precios, recalcula el total, guarda el pedido, genera el PDF y arma el mensaje de WhatsApp. La cotización es referencial y se borra sola a los 15 días.
- **Promociones** (`/promociones`): combos por tiempo limitado. Se piden por WhatsApp mostrando la imagen en el local; no entran al carrito.
- **Sobre nosotros** (`/nosotros`): historia, cobertura de entrega, dirección, horarios, teléfono, redes, mapa y galería de fotos del local con visor a pantalla completa.
- **Contacto**: botón flotante de WhatsApp. El número sale de los ajustes del sitio.
- **Animación**: desplazamiento suave (Lenis), aparición al hacer scroll (GSAP) y transición entre páginas. Todo se apaga si el sistema pide menos movimiento.
- **SEO**: título y descripción por página, datos estructurados de ferretería (`HardwareStore`), `robots.txt` y `sitemap.xml`. El panel, el carrito y la cotización no se indexan.

### Panel de administración (`/admin`)

El panel se carga aparte: quien recorre la tienda no descarga ese código. Entra con Supabase Auth y solo si su usuario está en la tabla `admins`.

- **Resumen**: cotizaciones y monto de los últimos 15 días, productos, agotados, sin precio, gráfico por día y lo más pedido.
- **Productos**: alta, edición y baja, variantes, marcas de oferta y más vendido, e imágenes con recorte.
- **Categorías**: alta, edición, orden y subcategorías. El árbol tiene como máximo dos niveles.
- **Combos y promociones**: imagen, título, precio en texto y fechas. Al vencer pasan a Expiradas y se pueden reactivar.
- **Cotizaciones**: historial con el PDF firmado.
- **Importar catálogo**: sube el JSON del normalizador (sale del Excel del sistema de facturación). Actualiza categorías por slug y productos y variantes por código de origen, y muestra un resumen de cambios.
- **Ajustes del sitio**: negocio y contacto, horario, portada, pasos del inicio, textos y fotos de Nosotros, guía de medidas para recortar, redes (Facebook, Instagram y TikTok), logo y textos para Google.

---

## Tecnologías

| Capa | Tecnología |
| --- | --- |
| Interfaz | React 19, Vite 7 y TypeScript |
| Estilos | Tailwind CSS 4 |
| Rutas | React Router 7 |
| Datos y acceso | Supabase (PostgreSQL, RLS y Storage) |
| Auth del panel | Supabase Auth |
| Servidor | Supabase Edge Function `create-quote` (Deno) |
| PDF | pdf-lib, generado en esa función |
| Validación | Zod 4, en el navegador y en la función |
| Búsqueda | Función SQL por palabras, más índice `pg_trgm` en la medida |
| Animación | Lenis, GSAP y ScrollTrigger |
| Recorte de imágenes | react-easy-crop |
| Rango de precio | react-range |
| Gráfico del resumen | Recharts |
| Metadatos | react-helmet-async |
| Analítica | Vercel Analytics, agrupada por ruta |
| Pruebas | Vitest |
| Despliegue | Vercel |

---

## Cómo correrla en tu computadora

Necesitas **Git** y **Node.js 20.19+ o 22.12+** (incluye npm). Vite 7 no corre en versiones más viejas.

```bash
git clone https://github.com/Scorpwik/tienda-ferreteria-lozada.git
cd tienda-ferreteria-lozada
npm install
```

Crea un archivo `.env.local` en la carpeta raíz y ponle las dos variables del frontend (los nombres están más abajo). Vite lo lee solo y Git lo ignora.

```bash
npm run dev
```

Abre [http://localhost:5173](http://localhost:5173). En local solo corre la interfaz: la base y la función de cotizar viven en el proyecto de Supabase.

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Revisa tipos y genera la versión de producción |
| `npm run preview` | Sirve esa versión en local |
| `npm run lint` | Revisa tipos con TypeScript, sin emitir archivos |
| `npm test` | Corre las pruebas con Vitest |

`node_modules/` y `dist/` no van al repositorio. Si en otra computadora faltan estilos o animaciones, vuelve a correr `npm install`.

---

## Variables de entorno

Solo los nombres. El valor lo pones tú en tu máquina o en los secretos del servicio. Ninguna clave va en este archivo ni en el código del frontend.

### Frontend (`.env.local`)

Las exige `src/lib/env.ts`. Si falta alguna, la tienda no arranca.

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

La clave publicable es la del cliente. La **service role** no va aquí.

### Función `create-quote` (secretos de Supabase)

La plataforma las inyecta al desplegar la función. No las pongas en `.env.local`.

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### Redespliegue manual de la función

`scripts/deploy-create-quote.mjs` la usa y se detiene si no está definida.

- `SUPABASE_ACCESS_TOKEN`

---

## Estructura del proyecto

```
tienda-ferreteria-lozada/
  index.html
  public/                  favicon, robots.txt y sitemap.xml
  scripts/                 redespliegue de create-quote
  src/
    animation/             Lenis, transiciones, reveal y reduced-motion
    components/            botones, estados, migas e insignias
    data/                  lecturas y escrituras; la interfaz no consulta tablas directo
    features/
      about/               carrusel y visor de fotos
      admin/               formularios, recorte y gráfico
      auth/                sesión y puerta del panel
      cart/                carrito y su persistencia
      catalog/             tarjetas, filtros y buscador
      promotions/          combos del inicio y de /promociones
      quote/               nombre del cliente y resultado del PDF
      settings/            ajustes del sitio
      whatsapp/            botón y texto del mensaje
    layout/                cabecera, pie, panel y navegación móvil
    lib/                   cliente de Supabase, Zod, formatos y rutas
    pages/                 pantallas públicas
      admin/               resumen, productos, categorías, combos, cotizaciones, importar y ajustes
    styles/
  supabase/
    functions/create-quote/  valida, recalcula, guarda, genera el PDF
    migrations/              SQL versionado
  vercel.json
  vite.config.ts
```

Las decisiones de datos y las fases del proyecto están en `.cursor/ARCHITECTURE.md`. Las reglas de trabajo, en `.cursor/cursor_rules`.

---

## Autor

**Joshua Lozada** — [Scorpwik](https://github.com/Scorpwik)
