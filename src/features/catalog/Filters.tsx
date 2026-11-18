import { useEffect, useId, useRef, useState } from 'react'
import { Range, getTrackBackground } from 'react-range'
import { BottomSheet } from '@/components/BottomSheet'
import { useIsDesktop } from '@/animation/useIsDesktop'
import { formatMoney } from '@/lib/format'
import type { Availability } from '@/lib/domain'

const availabilityOptions: { value: Availability | ''; label: string }[] = [
  { value: '', label: 'Todas' },
  { value: 'disponible', label: 'Disponible' },
  { value: 'agotado', label: 'Agotado' },
  { value: 'consultar', label: 'Consultar' },
]

export type CatalogFiltersValue = {
  availability: Availability | null
  priceMin: number | null
  priceMax: number | null
}

type Props = {
  value: CatalogFiltersValue
  priceCeiling: number
  onChange: (next: CatalogFiltersValue) => void
  onlyOffers?: boolean
  onlyBestsellers?: boolean
  onToggleOffers?: () => void
  onToggleBestsellers?: () => void
}

function FilterIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 5h16l-6.5 7.5v5L10.5 19v-6.5L4 5z" />
    </svg>
  )
}

function priceStep(ceiling: number): number {
  if (ceiling <= 10) return 0.01
  if (ceiling <= 100) return 0.1
  return 1
}

function snap(value: number, step: number): number {
  const rounded = Math.round(value / step) * step
  return Number(rounded.toFixed(step < 1 ? 2 : 0))
}

type FilterFieldsProps = {
  value: CatalogFiltersValue
  onChange: (next: CatalogFiltersValue) => void
  draftRange: [number, number]
  setDraftRange: (next: [number, number]) => void
  dragging: boolean
  setDragging: (next: boolean) => void
  minBound: number
  maxBound: number
  step: number
  commitRange: (next: [number, number]) => void
  onlyOffers: boolean
  onlyBestsellers: boolean
  onToggleOffers?: () => void
  onToggleBestsellers?: () => void
  clearFilters: () => void
  onDone: () => void
  availabilityName?: string
}

function FilterFields({
  value,
  onChange,
  draftRange,
  setDraftRange,
  dragging,
  setDragging,
  minBound,
  maxBound,
  step,
  commitRange,
  onlyOffers,
  onlyBestsellers,
  onToggleOffers,
  onToggleBestsellers,
  clearFilters,
  onDone,
  availabilityName = 'filtro-disponibilidad',
}: FilterFieldsProps) {
  return (
    <>
      <fieldset className="mb-5">
        <legend className="text-ink-900 mb-3 text-sm font-bold">
          Rango de precio
        </legend>
        <p className="text-ink-700 mb-4 text-sm font-semibold tabular-nums">
          {formatMoney(draftRange[0])} – {formatMoney(draftRange[1])}
        </p>

        <Range
          values={draftRange}
          step={step}
          min={minBound}
          max={maxBound}
          onChange={(values) => {
            setDragging(true)
            setDraftRange([values[0], values[1]])
          }}
          onFinalChange={(values) => {
            const next: [number, number] = [values[0], values[1]]
            setDraftRange(next)
            setDragging(false)
            commitRange(next)
          }}
          renderTrack={({ props, children }) => (
            <div
              onMouseDown={props.onMouseDown}
              onTouchStart={props.onTouchStart}
              className="flex h-8 w-full items-center"
              style={props.style}
            >
              <div
                ref={props.ref}
                className="h-1.5 w-full rounded-full"
                style={{
                  background: getTrackBackground({
                    values: draftRange,
                    colors: ['#e5e5e5', '#c62603', '#e5e5e5'],
                    min: minBound,
                    max: maxBound,
                  }),
                }}
              >
                {children}
              </div>
            </div>
          )}
          renderThumb={({ props, isDragged }) => {
            const { key, ...thumbProps } = props
            const active = isDragged || dragging
            return (
              <div
                key={key}
                {...thumbProps}
                className={`border-brand-700 size-5 rounded-full border-2 bg-white shadow-md outline-none ring-brand-600 focus-visible:ring-2 ${
                  active ? 'scale-110' : ''
                }`}
                style={{
                  ...thumbProps.style,
                  transition: 'none',
                }}
              />
            )
          }}
        />

        <div className="text-ink-400 mt-2 flex justify-between text-xs">
          <span>{formatMoney(minBound)}</span>
          <span>{formatMoney(maxBound)}</span>
        </div>
      </fieldset>

      {onToggleOffers && onToggleBestsellers ? (
        <fieldset className="mb-5">
          <legend className="text-ink-900 mb-3 text-sm font-bold">Destacados</legend>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              aria-pressed={onlyOffers}
              onClick={onToggleOffers}
              className={`rounded-lg border px-3 py-2.5 text-left text-sm font-semibold ${
                onlyOffers
                  ? 'border-brand-600 bg-brand-50 text-brand-800'
                  : 'border-ink-200 text-ink-800 hover:border-ink-300'
              }`}
            >
              Solo ofertas
            </button>
            <button
              type="button"
              aria-pressed={onlyBestsellers}
              onClick={onToggleBestsellers}
              className={`rounded-lg border px-3 py-2.5 text-left text-sm font-semibold ${
                onlyBestsellers
                  ? 'border-brand-600 bg-brand-50 text-brand-800'
                  : 'border-ink-200 text-ink-800 hover:border-ink-300'
              }`}
            >
              Solo más vendidos
            </button>
          </div>
        </fieldset>
      ) : null}

      <fieldset>
        <legend className="text-ink-900 mb-3 text-sm font-bold">Disponibilidad</legend>
        <div className="flex flex-col gap-2">
          {availabilityOptions.map((option) => {
            const checked = (value.availability ?? '') === option.value
            return (
              <label
                key={option.value || 'todas'}
                className={`border-ink-200 flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors ${
                  checked
                    ? 'border-brand-600 bg-brand-50 text-brand-800'
                    : 'bg-white text-ink-800 hover:border-ink-300'
                }`}
              >
                <input
                  type="radio"
                  name={availabilityName}
                  value={option.value}
                  checked={checked}
                  onChange={() =>
                    onChange({
                      ...value,
                      availability: option.value
                        ? (option.value as Availability)
                        : null,
                    })
                  }
                  className="accent-brand-700 size-4"
                />
                {option.label}
              </label>
            )
          })}
        </div>
      </fieldset>

      <div className="mt-5 flex flex-wrap gap-2 border-t border-ink-100 pt-4">
        <button
          type="button"
          onClick={clearFilters}
          className="text-ink-600 hover:text-ink-900 text-sm font-semibold underline decoration-dotted"
        >
          Limpiar filtros
        </button>
        <button
          type="button"
          onClick={onDone}
          className="bg-brand-700 ml-auto rounded-lg px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
        >
          Ver resultados
        </button>
      </div>
    </>
  )
}

/**
 * Panel "Filtros": rango de precio + disponibilidad.
 * Ofertas / más vendidos viven fuera, en la barra del catálogo.
 */
export function Filters({
  value,
  priceCeiling,
  onChange,
  onlyOffers = false,
  onlyBestsellers = false,
  onToggleOffers,
  onToggleBestsellers,
}: Props) {
  const panelId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const isDesktop = useIsDesktop()
  const ceiling = Math.max(1, priceCeiling)
  const step = priceStep(ceiling)

  const minBound = 0
  const maxBound = ceiling
  const currentMin = value.priceMin ?? minBound
  const currentMax = value.priceMax ?? maxBound
  const [draftRange, setDraftRange] = useState<[number, number]>([
    currentMin,
    currentMax,
  ])
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    setDraftRange([
      value.priceMin ?? minBound,
      value.priceMax ?? maxBound,
    ])
  }, [value.priceMin, value.priceMax, minBound, maxBound])

  useEffect(() => {
    if (!open || !isDesktop) return

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    const onPointer = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null
      if (target && rootRef.current && !rootRef.current.contains(target)) {
        setOpen(false)
      }
    }

    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('touchstart', onPointer, { passive: true })
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('touchstart', onPointer)
    }
  }, [open, isDesktop])

  const activeCount =
    (value.availability ? 1 : 0) +
    (value.priceMin != null || value.priceMax != null ? 1 : 0) +
    (onlyOffers ? 1 : 0) +
    (onlyBestsellers ? 1 : 0)

  const commitRange = (next: [number, number]) => {
    const [rawMin, rawMax] = next
    let min = snap(Math.min(rawMin, rawMax), step)
    let max = snap(Math.max(rawMin, rawMax), step)
    min = Math.max(minBound, Math.min(min, maxBound))
    max = Math.max(minBound, Math.min(max, maxBound))

    const priceMin = min <= minBound ? null : min
    const priceMax = max >= maxBound ? null : max
    onChange({ ...value, priceMin, priceMax })
  }

  const clearFilters = () => {
    setDraftRange([minBound, maxBound])
    onChange({ availability: null, priceMin: null, priceMax: null })
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls={panelId}
        className={`border-ink-200 inline-flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm font-semibold transition-colors ${
          open || activeCount > 0
            ? 'border-brand-600 text-brand-700 bg-brand-50'
            : 'bg-white text-ink-900 hover:border-ink-300'
        }`}
      >
        <FilterIcon className="size-4 shrink-0" />
        Filtros
        {activeCount > 0 ? (
          <span className="bg-brand-700 inline-flex size-5 items-center justify-center rounded-full text-[0.65rem] font-bold text-white">
            {activeCount}
          </span>
        ) : null}
      </button>

      {!isDesktop ? (
        <BottomSheet
          open={open}
          onClose={() => setOpen(false)}
          title="Filtros"
          description="Precio y disponibilidad por medida."
        >
          <FilterFields
            value={value}
            onChange={onChange}
            draftRange={draftRange}
            setDraftRange={setDraftRange}
            dragging={dragging}
            setDragging={setDragging}
            minBound={minBound}
            maxBound={maxBound}
            step={step}
            commitRange={commitRange}
            onlyOffers={onlyOffers}
            onlyBestsellers={onlyBestsellers}
            onToggleOffers={onToggleOffers}
            onToggleBestsellers={onToggleBestsellers}
            clearFilters={clearFilters}
            onDone={() => setOpen(false)}
          />
        </BottomSheet>
      ) : open ? (
        <div
          id={panelId}
          role="dialog"
          aria-modal="true"
          aria-label="Filtros del catálogo"
          className="border-ink-100 absolute left-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border bg-white p-5 shadow-xl"
        >
          <div className="mb-4">
            <h2 className="text-ink-900 text-base font-extrabold">Filtros</h2>
            <p className="text-ink-500 mt-0.5 text-xs">
              Precio y disponibilidad por medida.
            </p>
          </div>
          <FilterFields
            value={value}
            onChange={onChange}
            draftRange={draftRange}
            setDraftRange={setDraftRange}
            dragging={dragging}
            setDragging={setDragging}
            minBound={minBound}
            maxBound={maxBound}
            step={step}
            commitRange={commitRange}
            onlyOffers={onlyOffers}
            onlyBestsellers={onlyBestsellers}
            onToggleOffers={onToggleOffers}
            onToggleBestsellers={onToggleBestsellers}
            clearFilters={clearFilters}
            onDone={() => setOpen(false)}
            availabilityName="filtro-disponibilidad-desktop"
          />
        </div>
      ) : null}
    </div>
  )
}
