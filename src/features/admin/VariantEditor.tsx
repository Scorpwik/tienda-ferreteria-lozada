import { useState } from 'react'
import { Button } from '@/components/Button'
import { useAdminToast } from './AdminToast'
import { AdminCard, Field, FormError } from './FormControls'
import { QuickAvailabilityField, QuickPriceField } from './QuickPriceField'
import {
  createVariant,
  deleteVariant,
  patchVariant,
  updateVariant,
} from '@/data/admin'
import type { VariantFormValues } from '@/data/admin'
import type { Availability, Variant } from '@/lib/domain'
import { availabilityLabels, formatPrice, variantFullLabel } from '@/lib/format'

/**
 * Editor de variantes. Precio y disponibilidad se cambian en la misma tabla,
 * que es lo que la ferreteria hace todos los dias; el resto de campos se abre
 * en el formulario.
 */

const emptyVariant: VariantFormValues = {
  origin_id: null,
  size: null,
  color: null,
  presentation: null,
  sale_unit: null,
  price: 0,
  barcode: null,
  availability: 'disponible',
}

const availabilityOptions: Availability[] = ['disponible', 'agotado', 'consultar']

const availabilityTone: Record<Availability, string> = {
  disponible: 'text-emerald-800',
  agotado: 'text-red-700',
  consultar: 'text-amber-brand-dark',
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`text-ink-500 size-4 shrink-0 transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
      aria-hidden="true"
    >
      <path d="M7 4.5 13 10 7 15.5" />
    </svg>
  )
}

function toFormValues(variant: Variant): VariantFormValues {
  return {
    origin_id: variant.origin_id,
    size: variant.size,
    color: variant.color,
    presentation: variant.presentation,
    sale_unit: variant.sale_unit,
    price: variant.price,
    barcode: variant.barcode,
    availability: variant.availability,
  }
}

export function VariantEditor({
  productId,
  variants,
  onChanged,
}: {
  productId: string
  variants: Variant[]
  onChanged: () => void
}) {
  const toast = useAdminToast()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<VariantFormValues>(emptyVariant)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set())

  const allOpen = variants.length > 0 && variants.every((variant) => openIds.has(variant.id))

  const toggleOpen = (id: string) => {
    setOpenIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    setOpenIds(allOpen ? new Set() : new Set(variants.map((variant) => variant.id)))
  }

  const openNew = () => {
    setError(null)
    setEditingId(null)
    setForm(emptyVariant)
    setCreating(true)
  }

  const openEdit = (variant: Variant) => {
    setError(null)
    setCreating(false)
    setEditingId(variant.id)
    setForm(toFormValues(variant))
    setOpenIds((current) => new Set(current).add(variant.id))
  }

  const close = () => {
    setCreating(false)
    setEditingId(null)
    setError(null)
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (editingId) {
        await updateVariant(editingId, form)
        toast.success('Variante actualizada.')
      } else {
        await createVariant(productId, form)
        toast.success('Variante añadida.')
      }
      close()
      onChanged()
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : 'No se pudo guardar.'
      setError(message)
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  const quickPatch = async (
    id: string,
    patch: { price?: number; availability?: Availability },
  ) => {
    setError(null)
    try {
      await patchVariant(id, patch)
      onChanged()
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : 'No se pudo actualizar.'
      setError(message)
      toast.error(message)
      onChanged()
      throw cause
    }
  }

  const remove = async (variant: Variant) => {
    const label = variantFullLabel(variant) || 'esta variante'
    if (!window.confirm(`¿Borrar ${label}?`)) return
    setError(null)
    try {
      await deleteVariant(variant.id)
      if (editingId === variant.id) close()
      toast.success('Variante borrada.')
      onChanged()
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : 'No se pudo borrar.'
      setError(message)
      toast.error(message)
    }
  }

  return (
    <AdminCard
      title="Variantes"
      description="Medidas, colores y presentaciones con su precio. Un producto sin variantes no se puede pedir."
      actions={
        <div className="flex flex-wrap gap-2">
          {variants.length > 1 ? (
            <Button type="button" size="sm" variant="outline" onClick={toggleAll}>
              {allOpen ? 'Cerrar todas' : 'Abrir todas'}
            </Button>
          ) : null}
          <Button type="button" size="sm" onClick={openNew}>
            Añadir variante
          </Button>
        </div>
      }
    >
      {error ? (
        <div className="mb-4">
          <FormError>{error}</FormError>
        </div>
      ) : null}

      {variants.length === 0 && !creating ? (
        <p className="text-ink-600 text-sm">
          Este producto todavía no tiene variantes. Añade al menos una con su
          precio y forma de venta.
        </p>
      ) : (
        <ul className="divide-ink-100 divide-y">
          {variants.map((variant) => {
            const label = variantFullLabel(variant) || 'Variante única'
            const open = openIds.has(variant.id)
            const panelId = `variant-panel-${variant.id}`
            const missingPrice =
              variant.availability === 'disponible' && variant.price <= 0
            const hiddenPrice =
              variant.availability === 'consultar' && variant.price > 0

            return (
              <li key={variant.id} className="py-1.5">
                <button
                  type="button"
                  onClick={() => toggleOpen(variant.id)}
                  aria-expanded={open}
                  aria-controls={panelId}
                  className="hover:bg-ink-50 flex w-full items-center gap-2 rounded-lg px-1 py-1.5 text-left"
                >
                  <Chevron open={open} />
                  <span className="min-w-0 flex-1">
                    <span className="text-ink-900 block truncate text-sm font-semibold">
                      {label}
                    </span>
                    <span className="text-ink-500 block truncate text-xs">
                      {variant.origin_id ? `Código ${variant.origin_id}` : 'Sin código'}
                      {variant.barcode ? ` · Barras ${variant.barcode}` : ''}
                    </span>
                  </span>
                  <span className="text-ink-900 shrink-0 text-sm font-semibold tabular-nums">
                    {variant.price > 0 ? formatPrice(variant.price) : 'Sin precio'}
                  </span>
                  <span
                    className={`shrink-0 text-xs font-semibold ${availabilityTone[variant.availability]}`}
                  >
                    {availabilityLabels[variant.availability]}
                  </span>
                  {missingPrice || hiddenPrice ? (
                    <span
                      className="bg-amber-brand size-2 shrink-0 rounded-full"
                      title="Revisa precio o disponibilidad"
                    />
                  ) : null}
                </button>

                {open ? (
                  <div id={panelId} className="mt-2 space-y-2 pb-2 pl-7">
                    <div className="flex flex-wrap items-center gap-3">
                      <QuickPriceField
                        value={variant.price}
                        ariaLabel={`Precio de ${label}`}
                        onSave={(price) => quickPatch(variant.id, { price })}
                      />

                      <QuickAvailabilityField
                        value={variant.availability}
                        ariaLabel={`Disponibilidad de ${label}`}
                        onSave={(availability) =>
                          quickPatch(variant.id, { availability })
                        }
                      />

                      <div className="flex shrink-0 gap-3">
                        <button
                          type="button"
                          onClick={() => openEdit(variant)}
                          className="text-brand-700 text-sm font-semibold underline"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => void remove(variant)}
                          className="text-sm font-semibold text-red-700 underline"
                        >
                          Borrar
                        </button>
                      </div>
                    </div>

                    {missingPrice ? (
                      <p className="text-amber-brand-dark text-xs font-semibold">
                        Está marcada como disponible pero sin precio: el cliente no
                        podrá añadirla al carrito.
                      </p>
                    ) : null}

                    {hiddenPrice ? (
                      <p className="text-amber-brand-dark text-xs font-semibold">
                        Tiene precio ({formatPrice(variant.price)}) pero está en
                        “Consultar”: la tienda no lo muestra. Cambia a Disponible para
                        publicarlo.
                      </p>
                    ) : null}

                    {variant.availability !== 'consultar' && variant.price > 0 ? (
                      <p className="text-ink-500 text-xs">
                        Se muestra como {formatPrice(variant.price)}
                        {variant.sale_unit ? ` por ${variant.sale_unit}` : ''}.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}

      {creating || editingId ? (
        <form
          onSubmit={(event) => void submit(event)}
          className="border-ink-100 mt-5 space-y-4 rounded-lg border bg-ink-50 p-4"
        >
          <p className="text-ink-900 text-sm font-bold">
            {editingId ? 'Editar variante' : 'Nueva variante'}
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Medida"
              htmlFor="variant-size"
              hint="Ejemplo: 4x1, 1/2 pulgada"
            >
              <input
                id="variant-size"
                value={form.size ?? ''}
                onChange={(event) =>
                  setForm((c) => ({ ...c, size: event.target.value }))
                }
                className="admin-input"
              />
            </Field>

            <Field label="Color" htmlFor="variant-color">
              <input
                id="variant-color"
                value={form.color ?? ''}
                onChange={(event) =>
                  setForm((c) => ({ ...c, color: event.target.value }))
                }
                className="admin-input"
              />
            </Field>

            <Field
              label="Presentación"
              htmlFor="variant-presentation"
              hint="Ejemplo: Caja de 100, Saco"
            >
              <input
                id="variant-presentation"
                value={form.presentation ?? ''}
                onChange={(event) =>
                  setForm((c) => ({ ...c, presentation: event.target.value }))
                }
                className="admin-input"
              />
            </Field>

            <Field
              label="Forma de venta"
              htmlFor="variant-unit"
              hint="Ejemplo: unidad, metro, quintal"
            >
              <input
                id="variant-unit"
                value={form.sale_unit ?? ''}
                onChange={(event) =>
                  setForm((c) => ({ ...c, sale_unit: event.target.value }))
                }
                className="admin-input"
              />
            </Field>

            <Field
              label="Precio"
              htmlFor="variant-price"
              hint="Admite hasta 4 decimales, para artículos de centavos."
            >
              <input
                id="variant-price"
                type="number"
                step="0.0001"
                min="0"
                value={form.price}
                onChange={(event) =>
                  setForm((c) => ({ ...c, price: Number(event.target.value) }))
                }
                required
                className="admin-input"
              />
            </Field>

            <Field label="Disponibilidad" htmlFor="variant-availability">
              <select
                id="variant-availability"
                value={form.availability}
                onChange={(event) =>
                  setForm((c) => ({
                    ...c,
                    availability: event.target.value as Availability,
                  }))
                }
                className="admin-input"
              >
                {availabilityOptions.map((option) => (
                  <option key={option} value={option}>
                    {availabilityLabels[option]}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="Código del sistema"
              htmlFor="variant-origin"
              hint="El ID producto de la facturación. Es el que usa el importador."
            >
              <input
                id="variant-origin"
                type="number"
                min="1"
                value={form.origin_id ?? ''}
                onChange={(event) =>
                  setForm((c) => ({
                    ...c,
                    origin_id: event.target.value
                      ? Number(event.target.value)
                      : null,
                  }))
                }
                className="admin-input"
              />
            </Field>

            <Field
              label="Código de barras"
              htmlFor="variant-barcode"
              hint="Solo informativo: puede repetirse entre productos."
            >
              <input
                id="variant-barcode"
                value={form.barcode ?? ''}
                onChange={(event) =>
                  setForm((c) => ({ ...c, barcode: event.target.value }))
                }
                className="admin-input"
              />
            </Field>
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>
              {busy ? 'Guardando…' : 'Guardar variante'}
            </Button>
            <Button type="button" variant="outline" onClick={close}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : null}
    </AdminCard>
  )
}
