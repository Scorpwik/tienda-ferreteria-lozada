import { useEffect, useRef, useState } from 'react'
import type { Availability } from '@/lib/domain'
import { availabilityLabels } from '@/lib/format'

/**
 * Precio editable en la lista. Se guarda al salir del recuadro o al pulsar
 * Enter, sin recargar la pagina ni abrir la ficha.
 */
export function QuickPriceField({
  value,
  ariaLabel,
  disabled,
  onSave,
}: {
  value: number
  ariaLabel: string
  disabled?: boolean
  onSave: (price: number) => Promise<void>
}) {
  const [draft, setDraft] = useState(formatDraft(value))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const savedTimer = useRef<number | null>(null)

  useEffect(() => {
    if (!saving) setDraft(formatDraft(value))
  }, [value, saving])

  useEffect(
    () => () => {
      if (savedTimer.current) window.clearTimeout(savedTimer.current)
    },
    [],
  )

  const commit = async () => {
    const next = Number(draft.replace(',', '.'))
    if (!Number.isFinite(next) || next < 0) {
      setDraft(formatDraft(value))
      return
    }
    if (next === value) return

    setSaving(true)
    setSaved(false)
    try {
      await onSave(next)
      setSaved(true)
      if (savedTimer.current) window.clearTimeout(savedTimer.current)
      savedTimer.current = window.setTimeout(() => setSaved(false), 1600)
    } catch {
      setDraft(formatDraft(value))
    } finally {
      setSaving(false)
    }
  }

  return (
    <label className="flex min-w-0 items-center gap-1">
      <span className="text-ink-500 text-sm font-semibold">$</span>
      <input
        type="text"
        inputMode="decimal"
        value={draft}
        disabled={disabled || saving}
        aria-label={ariaLabel}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => {
          setDraft(event.target.value)
          setSaved(false)
        }}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            void commit()
            event.currentTarget.blur()
          }
          if (event.key === 'Escape') {
            setDraft(formatDraft(value))
            event.currentTarget.blur()
          }
        }}
        title="Escribe el precio y pulsa Enter o sal del recuadro para guardar"
        className={`admin-input-sm w-28 tabular-nums ${
          saved ? 'border-emerald-400' : ''
        }`}
      />
      <span className="w-10 text-xs font-semibold text-emerald-700">
        {saving ? '…' : saved ? 'OK' : ''}
      </span>
    </label>
  )
}

const availabilityOptions: Availability[] = ['disponible', 'agotado', 'consultar']

export function QuickAvailabilityField({
  value,
  ariaLabel,
  disabled,
  onSave,
}: {
  value: Availability
  ariaLabel: string
  disabled?: boolean
  onSave: (value: Availability) => Promise<void>
}) {
  const [busy, setBusy] = useState(false)

  return (
    <select
      value={value}
      disabled={disabled || busy}
      aria-label={ariaLabel}
      onChange={(event) => {
        const next = event.target.value as Availability
        if (next === value) return
        setBusy(true)
        void onSave(next).finally(() => setBusy(false))
      }}
      className="admin-input-sm w-36"
    >
      {availabilityOptions.map((option) => (
        <option key={option} value={option}>
          {availabilityLabels[option]}
        </option>
      ))}
    </select>
  )
}

function formatDraft(value: number): string {
  if (!Number.isFinite(value)) return '0'
  if (Number.isInteger(value)) return String(value)
  return String(value)
}
