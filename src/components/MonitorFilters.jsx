import React, { useState, useMemo, useRef, useEffect } from 'react'
import {
  FaCalendarDay, FaCalendarWeek, FaCalendar, FaCalendarAlt,
  FaFilter, FaTimes, FaSync, FaPause, FaPlay, FaClock, FaExchangeAlt,
  FaChevronDown, FaBullseye,
} from 'react-icons/fa'
import DateRangePicker from './DateRangePicker'

const PERIOD_OPTIONS = [
  { id: 'today', label: 'Hoje', icon: FaCalendarDay, prominent: true },
  { id: 'yesterday', label: 'Ontem', icon: FaCalendarDay },
  { id: 'last7days', label: '7 dias', icon: FaCalendarWeek },
  { id: 'last30days', label: '30 dias', icon: FaCalendar },
  { id: 'last90days', label: '90 dias', icon: FaCalendar },
  { id: 'custom', label: 'Personalizado', icon: FaCalendarAlt },
]

function MultiSelectDropdown({ label, options, selected, onChange, searchable = true, maxHeight = 280 }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const filtered = useMemo(() => {
    if (!search) return options
    const q = search.toLowerCase()
    return options.filter((o) => String(o.label).toLowerCase().includes(q))
  }, [options, search])

  const toggle = (val) => {
    if (selected.includes(val)) onChange(selected.filter((v) => v !== val))
    else onChange([...selected, val])
  }

  const clearAll = (e) => { e.stopPropagation(); onChange([]) }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
          selected.length > 0
            ? 'bg-primary/10 dark:bg-primary/20 text-primary border-primary/30'
            : 'bg-white dark:bg-[#141419] text-gray-600 dark:text-gray-300 border-gray-200 dark:border-[#27272a] hover:bg-gray-50 dark:hover:bg-gray-800'
        }`}
      >
        <span className="truncate max-w-[140px]">{label}</span>
        {selected.length > 0 && (
          <>
            <span className="px-1.5 py-0.5 rounded-full bg-primary text-white text-[10px] font-bold leading-none">{selected.length}</span>
            <FaTimes className="w-2.5 h-2.5 hover:scale-125 transition" onClick={clearAll} />
          </>
        )}
        <FaChevronDown className={`w-2.5 h-2.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-72 bg-white dark:bg-[#141419] rounded-xl shadow-2xl border border-gray-200 dark:border-[#27272a] overflow-hidden">
          {searchable && (
            <div className="p-2 border-b border-gray-100 dark:border-[#27272a]">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="w-full px-3 py-1.5 text-xs rounded-md bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          )}
          <div className="overflow-y-auto" style={{ maxHeight }}>
            {filtered.length === 0 && <div className="px-3 py-4 text-xs text-gray-400 text-center">Nenhuma opção</div>}
            {filtered.map((o) => {
              const active = selected.includes(o.value)
              return (
                <button
                  key={o.value}
                  onClick={() => toggle(o.value)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-800 transition ${
                    active ? 'bg-primary/5' : ''
                  }`}
                >
                  <span className="text-left truncate">{o.label}</span>
                  {o.count !== undefined && (
                    <span className="text-[10px] text-gray-400 ml-2">{o.count.toLocaleString('pt-BR')}</span>
                  )}
                  <span className={`ml-2 w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                    active ? 'bg-primary border-primary' : 'border-gray-300 dark:border-gray-600'
                  }`}>
                    {active && <span className="text-white text-[10px] leading-none">✓</span>}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

const MonitorFilters = ({
  filters,
  onChange,
  sourceOptions = [],
  mediumOptions = [],
  campaignOptions = [],
  tagOptions = [],
  onRefresh,
  autoRefresh,
  onToggleAutoRefresh,
  refreshInterval,
  onChangeInterval,
  lastUpdate,
  loading,
}) => {
  const [datePickerOpen, setDatePickerOpen] = useState(false)

  const setPeriod = (period) => {
    if (period === 'custom') { setDatePickerOpen(true); return }
    onChange({ ...filters, period, customStart: null, customEnd: null })
  }

  const toggleCompare = () => onChange({ ...filters, compare: !filters.compare })
  const toggleMetaCap = () => onChange({ ...filters, metaBucket: filters.metaBucket === 'cap' ? null : 'cap' })

  const handleCustomConfirm = (start, end) => {
    onChange({ ...filters, period: 'custom', customStart: start, customEnd: end })
    setDatePickerOpen(false)
  }

  const activeFiltersCount = useMemo(() => {
    let c = 0
    if (filters.utmSources?.length) c++
    if (filters.utmMediums?.length) c++
    if (filters.utmCampaigns?.length) c++
    if (filters.tags?.length) c++
    return c
  }, [filters])

  const clearFilters = () => onChange({
    ...filters,
    utmSources: [], utmMediums: [], utmCampaigns: [], tags: [],
  })

  return (
    <div className="sticky top-0 z-40 backdrop-blur-md bg-white/80 dark:bg-[#0a0a0c]/80 border-b border-gray-200 dark:border-[#27272a] -mx-6 px-6 py-4 mb-6">
      <div className="max-w-7xl mx-auto flex flex-col gap-3">
        {/* Linha 1: Período + Refresh */}
        <div className="flex flex-wrap items-center gap-2">
          {PERIOD_OPTIONS.map((p) => {
            const Icon = p.icon
            const active = filters.period === p.id
            const prominent = p.prominent && active
            return (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  active
                    ? prominent
                      ? 'bg-gradient-to-r from-primary to-primary-dark text-white shadow-lg shadow-primary/25'
                      : 'bg-white dark:bg-gray-800 text-text-light dark:text-text-dark shadow border border-primary/30'
                    : p.prominent
                      ? 'bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20'
                      : 'bg-white/50 dark:bg-[#141419]/50 text-gray-600 dark:text-gray-300 border border-transparent hover:bg-white dark:hover:bg-gray-800'
                }`}
              >
                <Icon className="w-3 h-3" />
                {p.label}
              </button>
            )
          })}

          <button
            onClick={toggleCompare}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition border ${
              filters.compare
                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-300/50'
                : 'bg-white dark:bg-[#141419] text-gray-600 dark:text-gray-300 border-gray-200 dark:border-[#27272a]'
            }`}
            title="Comparar com período anterior"
          >
            <FaExchangeAlt className="w-3 h-3" />
            Comparar
          </button>

          <button
            onClick={toggleMetaCap}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition border ${
              filters.metaBucket === 'cap'
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-400/50'
                : 'bg-white dark:bg-[#141419] text-gray-600 dark:text-gray-300 border-gray-200 dark:border-[#27272a]'
            }`}
            title="Filtrar Meta Ads para mostrar apenas campanhas de Captação (nome contém | CAP |)"
          >
            <FaBullseye className="w-3 h-3" />
            Só Captação
            {filters.metaBucket === 'cap' && <span className="text-[9px] opacity-70">(Meta)</span>}
          </button>

          <div className="flex-1" />

          {lastUpdate && (
            <span className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-gray-500 dark:text-gray-400 bg-white/50 dark:bg-[#141419]/50 border border-transparent">
              <FaClock className="w-3 h-3" />
              {lastUpdate.toLocaleTimeString('pt-BR')}
            </span>
          )}

          <button
            onClick={onToggleAutoRefresh}
            className={`p-2 rounded-lg border transition ${
              autoRefresh
                ? 'bg-primary/10 dark:bg-primary/20 border-primary/30 text-primary'
                : 'bg-white dark:bg-[#141419] border-gray-200 dark:border-[#27272a] text-gray-500'
            }`}
            title={autoRefresh ? 'Pausar auto-refresh' : 'Iniciar auto-refresh'}
          >
            {autoRefresh ? <FaPause className="w-3 h-3" /> : <FaPlay className="w-3 h-3" />}
          </button>

          {autoRefresh && (
            <select
              value={refreshInterval}
              onChange={(e) => onChangeInterval(parseInt(e.target.value, 10))}
              className="px-2 py-2 rounded-lg text-xs bg-white dark:bg-[#141419] border border-gray-200 dark:border-[#27272a] outline-none"
            >
              <option value={30000}>30s</option>
              <option value={60000}>1min</option>
              <option value={300000}>5min</option>
            </select>
          )}

          <button
            onClick={onRefresh}
            className="p-2 rounded-lg bg-gradient-to-r from-primary to-primary-dark text-white shadow hover:shadow-lg transition"
            title="Atualizar"
          >
            <FaSync className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Linha 2: Filtros UTM/Tag */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mr-1">
            <FaFilter className="w-3 h-3" />
            Filtros:
          </span>

          <MultiSelectDropdown
            label={filters.utmSources?.length ? `Source: ${filters.utmSources.length}` : 'UTM Source'}
            options={sourceOptions}
            selected={filters.utmSources || []}
            onChange={(v) => onChange({ ...filters, utmSources: v })}
          />
          <MultiSelectDropdown
            label={filters.utmMediums?.length ? `Medium: ${filters.utmMediums.length}` : 'UTM Medium'}
            options={mediumOptions}
            selected={filters.utmMediums || []}
            onChange={(v) => onChange({ ...filters, utmMediums: v })}
          />
          <MultiSelectDropdown
            label={filters.utmCampaigns?.length ? `Campaign: ${filters.utmCampaigns.length}` : 'UTM Campaign'}
            options={campaignOptions}
            selected={filters.utmCampaigns || []}
            onChange={(v) => onChange({ ...filters, utmCampaigns: v })}
          />
          <MultiSelectDropdown
            label={filters.tags?.length ? `Tags: ${filters.tags.length}` : 'Tags'}
            options={tagOptions}
            selected={filters.tags || []}
            onChange={(v) => onChange({ ...filters, tags: v })}
          />

          {activeFiltersCount > 0 && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition"
            >
              <FaTimes className="w-2.5 h-2.5" />
              Limpar ({activeFiltersCount})
            </button>
          )}
        </div>
      </div>

      {/* Modal de período custom */}
      {datePickerOpen && (
        <CustomDateModal
          start={filters.customStart}
          end={filters.customEnd}
          onConfirm={handleCustomConfirm}
          onClose={() => setDatePickerOpen(false)}
        />
      )}
    </div>
  )
}

function CustomDateModal({ start, end, onConfirm, onClose }) {
  const [s, setS] = useState(start || '')
  const [e, setE] = useState(end || '')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-[#141419] rounded-2xl p-6 shadow-2xl border border-gray-200 dark:border-[#27272a] max-w-md w-full">
        <h3 className="text-lg font-bold text-text-light dark:text-text-dark mb-4">Selecionar período</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Data inicial</label>
            <input
              type="date"
              value={s}
              onChange={(ev) => setS(ev.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Data final</label>
            <input
              type="date"
              value={e}
              onChange={(ev) => setE(ev.target.value)}
              min={s || ''}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700">Cancelar</button>
          <button
            onClick={() => onConfirm(s, e)}
            disabled={!s || !e}
            className="px-4 py-2 rounded-lg text-sm bg-gradient-to-r from-primary to-primary-dark text-white shadow disabled:opacity-50"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}

export default MonitorFilters
