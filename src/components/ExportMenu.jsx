import { useEffect, useId, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { ChevronDown, Download } from 'lucide-react'

export default function ExportMenu({ disabled = false, onExport, label = 'Exportar' }) {
  const [open, setOpen] = useState(false)
  const [alignRight, setAlignRight] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const busy = useRef(false)
  const restoreFocus = useRef(false)
  const container = useRef(null)
  const trigger = useRef(null)
  const id = useId()
  useEffect(() => {
    if (exporting || !restoreFocus.current) return
    restoreFocus.current = false
    if (!disabled && (document.activeElement === document.body || container.current?.contains(document.activeElement))) trigger.current?.focus()
  }, [exporting, disabled, open])
  // A screen that reloads disables the button; it must not reopen by itself afterwards.
  useEffect(() => { if (disabled) setOpen(false) }, [disabled])
  useEffect(() => {
    const close = event => { if (!container.current?.contains(event.target)) setOpen(false) }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [])
  async function download(format) {
    if (busy.current || disabled) return
    busy.current = true; setExporting(true); setError(''); setOpen(false)
    try { await onExport(format) }
    catch { setError('Não foi possível gerar o arquivo. Tente novamente.') }
    finally { busy.current = false; restoreFocus.current = true; setExporting(false) }
  }
  return <div ref={container} className="relative inline-flex flex-col items-start" onKeyDown={event => {
    if (event.key === 'Escape' && open) { event.stopPropagation(); setOpen(false); trigger.current?.focus() }
  }}>
    <button ref={trigger} type="button" className="btn btn-ghost disabled:opacity-40" disabled={disabled || exporting} aria-expanded={open && !disabled} aria-controls={id} onClick={() => { setAlignRight(trigger.current.getBoundingClientRect().right >= 192); setOpen(value => !value) }}>
      <Download size={16} aria-hidden="true" />{exporting ? 'Gerando arquivo…' : label}<ChevronDown size={14} aria-hidden="true" />
    </button>
    {open && !disabled && <div id={id} role="group" aria-label="Formatos de exportação" className={`ds-card absolute ${alignRight ? 'right-0' : 'left-0'} top-full z-50 mt-2 w-44 p-2 shadow-lg flex flex-col gap-1`}>
      {[['csv', 'CSV'], ['xlsx', 'Excel (.xlsx)'], ['pdf', 'PDF']].map(([format, name]) => <button key={format} type="button" className="btn btn-ghost justify-start" onClick={() => download(format)}>{name}</button>)}
    </div>}
    {error && <p role="alert" className="text-sm text-red-600 max-w-64 mt-2">{error}</p>}
  </div>
}

ExportMenu.propTypes = { disabled: PropTypes.bool, onExport: PropTypes.func.isRequired, label: PropTypes.string }
