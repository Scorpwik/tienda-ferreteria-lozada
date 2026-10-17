import { useRef, useState } from 'react'
import { Button } from '@/components/Button'
import {
  AdminCard,
  FormError,
  FormSuccess,
} from '@/features/admin/FormControls'
import { useAdminToast } from '@/features/admin/AdminToast'
import {
  importCatalog,
  ImportError,
  parseCatalogImport,
} from '@/data/adminImport'
import type { ImportSummary } from '@/data/adminImport'
import { useDocumentMeta } from '@/lib/useDocumentMeta'

const EXAMPLE = `{
  "categories": [
    { "id": "fijaciones", "nombre": "Fijaciones", "slug": "fijaciones" },
    { "id": "tornillos", "nombre": "Tornillos", "parent_id": "fijaciones" }
  ],
  "products": [
    {
      "id_origen": 1855,
      "nombre": "Tornillo para madera",
      "categoria_id": "tornillos",
      "slug": "tornillo-para-madera",
      "meta_title": "Tornillo para madera 6x2 | Ferretería Lozada",
      "meta_description": "Tornillo para madera en varias medidas. Cotiza por WhatsApp en Chillogallo.",
      "search_tags": ["tornillo", "madera", "fijaciones"],
      "variants": [
        {
          "id_origen": 185501,
          "nombre": "Tornillo 6x2",
          "medida": "6x2",
          "color": null,
          "presentacion": null,
          "forma_venta": "ciento",
          "precio": 1.25,
          "codigo_barra": "001321"
        }
      ]
    }
  ]
}`

function SummaryList({ summary }: { summary: ImportSummary }) {
  const rows = [
    ['Categorías nuevas', summary.categoriesCreated],
    ['Categorías actualizadas', summary.categoriesUpdated],
    ['Productos nuevos', summary.productsCreated],
    ['Productos actualizados', summary.productsUpdated],
    ['Variantes nuevas', summary.variantsCreated],
    ['Variantes actualizadas', summary.variantsUpdated],
  ] as const

  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <li
          key={label}
          className="border-ink-100 flex items-baseline justify-between gap-3 rounded-lg border bg-white px-3 py-2 text-sm"
        >
          <span className="text-ink-600">{label}</span>
          <span className="text-ink-900 font-extrabold">{value}</span>
        </li>
      ))}
    </ul>
  )
}

export default function AdminImport() {
  useDocumentMeta({ title: 'Importar catálogo | Administración', noIndex: true })
  const toast = useAdminToast()
  const fileRef = useRef<HTMLInputElement>(null)

  const [raw, setRaw] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ImportError | null>(null)
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  const loadFile = async (file: File) => {
    setError(null)
    setSummary(null)
    if (!file.name.toLowerCase().endsWith('.json') && file.type !== 'application/json') {
      setError(new ImportError('Solo se aceptan archivos .json.'))
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      setError(new ImportError('El archivo pesa demasiado (máximo 8 MB).'))
      return
    }
    try {
      const text = await file.text()
      setRaw(text)
      setFileName(file.name)
    } catch {
      setError(new ImportError('No se pudo leer el archivo.'))
    }
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setSummary(null)

    try {
      const catalog = parseCatalogImport(raw)
      const result = await importCatalog(catalog)
      setSummary(result)
      toast.success(
        `Importación lista: ${result.productsCreated + result.productsUpdated} productos, ${result.variantsCreated + result.variantsUpdated} variantes.`,
      )
    } catch (cause) {
      setError(
        cause instanceof ImportError
          ? cause
          : new ImportError(
              cause instanceof Error
                ? cause.message
                : 'No se pudo importar el catálogo.',
            ),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-ink-900 text-2xl font-extrabold">
          Importar catálogo
        </h1>
        <p className="text-ink-600 mt-1 max-w-2xl text-sm">
          Sube el JSON que genera el normalizador. Se actualizan categorías,
          productos y variantes por su código del sistema de facturación
          (`id_origen`). No se borran productos que no vengan en el archivo.
        </p>
      </div>

      <AdminCard
        title="Archivo o texto JSON"
        description="Puedes pegar el contenido o elegir un .json desde tu computadora."
      >
        <form onSubmit={(event) => void submit(event)} className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void loadFile(file)
                event.target.value = ''
              }}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
            >
              Elegir archivo JSON
            </Button>
            {fileName ? (
              <span className="text-ink-600 text-sm">
                Cargado: <span className="font-semibold">{fileName}</span>
              </span>
            ) : null}
            <button
              type="button"
              className="text-brand-700 text-sm font-semibold underline"
              onClick={() => {
                setRaw(EXAMPLE)
                setFileName(null)
                setError(null)
                setSummary(null)
              }}
              disabled={busy}
            >
              Ver ejemplo
            </button>
          </div>

          <label htmlFor="import-json" className="sr-only">
            Contenido JSON
          </label>
          <textarea
            id="import-json"
            value={raw}
            onChange={(event) => {
              setRaw(event.target.value)
              setFileName(null)
              setSummary(null)
            }}
            rows={16}
            spellCheck={false}
            disabled={busy}
            placeholder="Pega aquí el JSON del normalizador…"
            className="border-ink-200 text-ink-900 focus:border-brand-600 focus:ring-brand-600/20 w-full rounded-lg border bg-white px-3 py-2 font-mono text-xs leading-relaxed focus:ring-2 focus:outline-none disabled:opacity-60"
          />

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={busy || !raw.trim()}>
              {busy ? 'Importando…' : 'Importar catálogo'}
            </Button>
            <button
              type="button"
              className="text-ink-600 hover:text-ink-900 text-sm font-semibold"
              onClick={() => {
                setRaw('')
                setFileName(null)
                setError(null)
                setSummary(null)
              }}
              disabled={busy || !raw}
            >
              Limpiar
            </button>
          </div>

          {error ? (
            <div className="space-y-2">
              <FormError>{error.message}</FormError>
              {error.details.length > 0 ? (
                <ul className="list-inside list-disc text-sm text-red-800">
                  {error.details.map((detail) => (
                    <li key={detail}>{detail}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </form>
      </AdminCard>

      {summary ? (
        <AdminCard title="Resultado de la importación">
          <FormSuccess>
            Listo. Los cambios ya están en el catálogo público.
          </FormSuccess>
          <div className="mt-4">
            <SummaryList summary={summary} />
          </div>
          {summary.warnings.length > 0 ? (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="text-sm font-semibold text-amber-900">
                Advertencias ({summary.warnings.length})
              </p>
              <ul className="mt-1.5 list-inside list-disc text-sm text-amber-900">
                {summary.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </AdminCard>
      ) : null}

      <AdminCard title="Formato esperado">
        <p className="text-ink-600 text-sm">
          El normalizador debe exportar un objeto con{' '}
          <code className="text-ink-800">categories</code> y{' '}
          <code className="text-ink-800">products</code>. Las categorías usan
          un id temporal de texto; los productos y variantes se identifican por{' '}
          <code className="text-ink-800">id_origen</code> (nunca por código de
          barras). Campos en español: <code className="text-ink-800">nombre</code>,{' '}
          <code className="text-ink-800">id_origen</code>,{' '}
          <code className="text-ink-800">categoria_id</code>.
        </p>
      </AdminCard>
    </div>
  )
}
