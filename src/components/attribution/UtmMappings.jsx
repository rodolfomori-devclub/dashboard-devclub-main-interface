/* eslint-disable react/prop-types -- The attribution screen supplies the seller directory. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Link2, LoaderCircle, Plus, RefreshCw } from 'lucide-react'
import { getUtmMappings, normalizeUtmSource, saveUtmMapping } from '../../services/salesOpsService'

const validMapping = row => row && typeof row.utmSource === 'string' && typeof row.enabled === 'boolean'
  && Number.isSafeInteger(row.revision) && row.revision >= 0

export default function UtmMappings({ sellers, observedSources = [], onChanged }) {
  const [catalog, setCatalog] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState('')
  const [drafts, setDrafts] = useState({})
  const [extraSources, setExtraSources] = useState([])
  const [newSource, setNewSource] = useState('')
  const alive = useRef(false)
  const lock = useRef(false)
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const response = await getUtmMappings()
      if (response.available !== true || !Array.isArray(response.mappings) || !response.mappings.every(validMapping)) throw new Error('Não foi possível validar os vínculos de UTM.')
      if (alive.current) { setCatalog(response); setDrafts({}) }
    } catch (failure) { if (alive.current) setError(failure.message) }
    finally { if (alive.current) setLoading(false) }
  }, [])
  useEffect(() => { alive.current = true; load(); return () => { alive.current = false } }, [load])
  const rows = useMemo(() => {
    const current = new Map()
    for (const row of catalog?.mappings || []) current.set(normalizeUtmSource(row.utmSource), row)
    const suggestions = (catalog?.suggestions || []).map(value => typeof value === 'string' ? value : value.utmSource)
    for (const utmSource of [...suggestions, ...observedSources.filter(value => /^comercial[-_ ]/i.test(value)), ...extraSources]) {
      const key = normalizeUtmSource(utmSource)
      if (key && !current.has(key)) current.set(key, { utmSource, sellerId: null, sellerName: '', enabled: false, revision: 0 })
    }
    return [...current.values()].sort((a, b) => a.utmSource.localeCompare(b.utmSource, 'pt-BR'))
  }, [catalog, observedSources, extraSources])
  const addSource = event => {
    event.preventDefault()
    if (!newSource.trim()) return
    setExtraSources(values => [...values, newSource.trim()]); setNewSource('')
  }
  const save = async (row, enabled) => {
    if (lock.current) return
    const key = normalizeUtmSource(row.utmSource)
    const sellerId = Object.hasOwn(drafts, key) ? drafts[key] : row.sellerId
    if (enabled && !sellerId) { setError('Selecione o vendedor responsável por esta UTM.'); return }
    lock.current = true; setBusy(key); setError(''); setNotice('')
    try {
      await saveUtmMapping({ utmSource: row.utmSource, sellerId: sellerId || null, enabled, expectedRevision: row.revision })
      if (!alive.current) return
      await load()
      if (!alive.current) return
      setNotice(enabled ? `${row.utmSource} vinculada ao vendedor. As atribuições manuais continuam tendo prioridade.` : `Vínculo de ${row.utmSource} desativado. As atribuições manuais foram preservadas.`)
      await onChanged?.()
    } catch (failure) {
      if (!alive.current) return
      if (failure.status === 409) { await load(); if (alive.current) setError('Outro gestor alterou este vínculo. Confira a lista atualizada antes de salvar novamente.') }
      else setError(failure.message)
    } finally { lock.current = false; if (alive.current) setBusy('') }
  }
  return <section className="surface-panel utm-mappings" data-testid="utm-mappings" aria-labelledby="utm-mappings-title">
    <div className="utm-mappings-heading"><span><Link2 size={23}/></span><div><h2 id="utm-mappings-title">UTMs dos vendedores</h2><p>Vincule cada UTM Source uma vez para identificar as vendas automaticamente.</p></div><span className="utm-mappings-count">{loading ? 'Carregando vínculos…' : catalog ? `${catalog.mappings.filter(row => row.enabled).length} ativos` : 'Indisponível'}</span></div>
    <details><summary>Configurar vínculos de UTM</summary><p className="utm-mappings-description">Escolha quem recebe as vendas de cada origem, como Comercial-Emanuel. A seleção manual feita em uma venda prevalece sobre este cadastro. Links de checkout e nomes parecidos não criam vínculos automaticamente.</p>
      {notice && <p className="utm-mapping-success" role="status"><Check size={16}/>{notice}</p>}
      {error && <div className="notice notice-error" role="alert">{error}<button className="button" type="button" onClick={load} disabled={loading || Boolean(busy)}><RefreshCw size={15}/>Atualizar vínculos</button></div>}
      {loading && <p className="utm-mapping-loading" role="status"><LoaderCircle className="participation-spin" size={17}/>Carregando cadastro de UTMs…</p>}
      {catalog && <><ul className="utm-mapping-list" aria-label="Vínculos autorizados de UTM" aria-busy={loading || Boolean(busy)}>{rows.map(row => {
        const key = normalizeUtmSource(row.utmSource)
        const selected = Object.hasOwn(drafts, key) ? drafts[key] : row.sellerId || ''
        const currentSellerAvailable = !row.sellerId || sellers.some(seller => seller.id === row.sellerId)
        return <li key={key} data-testid={`utm-mapping-${encodeURIComponent(row.utmSource)}`}>
          <div><code>{row.utmSource}</code><small>{row.enabled ? `Vinculada a ${row.sellerName || 'vendedor cadastrado'}` : row.revision ? 'Vínculo desativado' : 'Aguardando vínculo'}</small></div>
          <select className="ds-input" aria-label={`Vendedor para ${row.utmSource}`} value={selected} disabled={loading || Boolean(busy)} onChange={event => setDrafts(values => ({ ...values, [key]: event.target.value }))}><option value="">Selecione o vendedor</option>{!currentSellerAvailable && <option value={row.sellerId} disabled>{row.sellerName || 'Vendedor indisponível'}</option>}{sellers.map(seller => <option key={seller.id} value={seller.id}>{seller.name}</option>)}</select>
          <div className="utm-mapping-actions"><button className="button button-primary" aria-label={`Salvar vínculo: ${row.utmSource}`} disabled={loading || Boolean(busy) || !selected} onClick={() => save(row, true)}>{busy === key ? <LoaderCircle size={15} className="participation-spin"/> : <Check size={15}/>}Salvar</button>{row.enabled && <button className="button" aria-label={`Desativar vínculo: ${row.utmSource}`} disabled={loading || Boolean(busy)} onClick={() => save(row, false)}>Desativar</button>}</div>
        </li>
      })}</ul><form onSubmit={addSource} className="utm-mapping-add"><label><span>Adicionar UTM Source</span><input className="ds-input" value={newSource} maxLength={500} onChange={event => setNewSource(event.target.value)} placeholder="Ex.: Comercial-Nome" disabled={loading || Boolean(busy)}/></label><button type="submit" className="button" disabled={loading || Boolean(busy) || !newSource.trim()}><Plus size={16}/>Adicionar origem</button></form></>}
    </details>
  </section>
}
