import { useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { ChevronDown } from 'lucide-react'
import { UNKNOWN } from '../utils/salesData'
import './productFilter.css'

const labelFor = value => value === UNKNOWN ? 'Não informado' : value
const searchable = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')

// eslint-disable-next-line react/prop-types
export default function ProductFilter({ value, options, onChange }) {
  const [search, setSearch] = useState('')
  const selected = Array.isArray(value) ? value : value ? [value] : []
  const choices = [...new Set([...options, ...selected].filter(item => item !== UNKNOWN && item !== 'Não informado')), UNKNOWN]
  const visible = choices.filter(item => searchable(labelFor(item)).includes(searchable(search.trim())))
  const summary = !selected.length ? 'Todos os produtos' : selected.length === 1 ? labelFor(selected[0]) : `${selected.length} produtos selecionados`

  function toggle(product) {
    const next = selected.includes(product) ? selected.filter(item => item !== product) : [...selected, product]
    // Other panels also use an empty string to identify an inactive filter.
    onChange(next.length ? next : '')
  }

  return <div className="product-filter">
    <label id="period-product-label" htmlFor="period-product" className="ds-label">Produto</label>
    <Popover.Root onOpenChange={open => { if (!open) setSearch('') }}>
      <Popover.Trigger asChild>
        <button id="period-product" type="button" className="ds-input product-filter-trigger" aria-labelledby="period-product-label period-product-value" title={selected.map(labelFor).join(', ') || summary}>
          <span id="period-product-value">{summary}</span><ChevronDown size={16} aria-hidden="true" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="product-filter-menu" align="start" sideOffset={6} collisionPadding={12} aria-label="Selecionar produtos">
          <p className="product-filter-hint">Selecione um ou mais produtos.</p>
          <input type="search" className="ds-input" aria-label="Buscar produtos" placeholder="Buscar produtos…" value={search} onChange={event => setSearch(event.target.value)} />
          <button type="button" className="product-filter-all" onClick={() => { onChange(''); setSearch('') }}>Todos os produtos</button>
          <div className="product-filter-options" role="group" aria-label="Produtos disponíveis">
            {visible.map(product => <label key={product} className="product-filter-option">
              <input type="checkbox" checked={selected.includes(product)} onChange={() => toggle(product)} />
              <span>{labelFor(product)}</span>
            </label>)}
            {!visible.length && <p className="product-filter-hint">Nenhum produto encontrado.</p>}
          </div>
          <div className="product-filter-footer">
            <span aria-live="polite">{selected.length ? `${selected.length} selecionado${selected.length === 1 ? '' : 's'}` : 'Todos os produtos'}</span>
            <Popover.Close asChild><button type="button" className="btn btn-ghost btn-sm">Concluir</button></Popover.Close>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  </div>
}
