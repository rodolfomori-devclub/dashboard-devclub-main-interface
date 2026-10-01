import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Check, LoaderCircle, RefreshCw, Search, Trophy, UserMinus, UserPlus } from 'lucide-react'
import { requestApi } from '../../lib/api'
import './rankingParticipation.css'

const searchable = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
const validUser = user => user && typeof user.id === 'string' && typeof user.name === 'string'
  && typeof user.excludedFromRanking === 'boolean' && Number.isSafeInteger(user.revision) && user.revision >= 0

export default function RankingParticipation() {
  const queryClient = useQueryClient()
  const [users, setUsers] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [limit, setLimit] = useState(50)
  const mounted = useRef(false)
  const saving = useRef(false)
  const currentLoad = useRef(null)

  const load = useCallback(async () => {
    currentLoad.current?.abort()
    const controller = new AbortController()
    currentLoad.current = controller
    setLoading(true)
    setError('')
    try {
      const result = await requestApi('/ranking-participation', { signal: controller.signal, cache: 'no-store' })
      if (!Array.isArray(result.users) || !result.users.every(validUser)) throw new Error('Não foi possível validar a lista de usuários. Tente novamente.')
      if (mounted.current && !controller.signal.aborted) setUsers([...result.users].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')))
    } catch (failure) {
      if (mounted.current && !controller.signal.aborted) setError(failure.message)
    } finally {
      if (mounted.current && !controller.signal.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    load()
    return () => { mounted.current = false; currentLoad.current?.abort() }
  }, [load])

  const change = async user => {
    if (saving.current || loading) return
    saving.current = true
    setBusy(user.id); setError(''); setMessage('')
    try {
      const result = await requestApi(`/ranking-participation/${encodeURIComponent(user.id)}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ excludedFromRanking: !user.excludedFromRanking, expectedRevision: user.revision }),
      })
      if (!validUser(result.user) || result.user.id !== user.id) throw new Error('O servidor não confirmou a alteração. Atualize a lista antes de tentar novamente.')
      // Existing profile consumers get the new participation state immediately.
      queryClient.setQueryData(['profiles'], profiles => Array.isArray(profiles)
        ? profiles.map(profile => profile.id === user.id ? { ...profile, excludedFromRanking: result.user.excludedFromRanking } : profile) : profiles)
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
      if (mounted.current) {
        setUsers(previous => previous.map(item => item.id === user.id ? result.user : item))
        setMessage(`${result.user.name} ${result.user.excludedFromRanking ? 'excluído dos cálculos' : 'incluído nos cálculos'}. As TVs atualizam automaticamente; a mudança pode levar até 2 minutos.`)
      }
    } catch (failure) {
      if (!mounted.current) return
      if (failure.status === 409) {
        await load()
        if (mounted.current) setError('Outro administrador alterou esta configuração. Atualizamos a lista; confira a participação antes de tentar novamente.')
      } else setError(failure.message)
    } finally {
      saving.current = false
      if (mounted.current) setBusy('')
    }
  }

  const filtered = useMemo(() => (users || []).filter(user => {
    const matchesStatus = filter === 'all' || (filter === 'excluded' ? user.excludedFromRanking : !user.excludedFromRanking)
    return matchesStatus && searchable(`${user.name} ${user.teamName || ''}`).includes(searchable(query.trim()))
  }), [users, query, filter])
  const excluded = users?.filter(user => user.excludedFromRanking).length || 0

  return <section className="surface-panel ranking-participation" data-testid="ranking-participation" aria-labelledby="ranking-participation-title">
    <div className="participation-heading"><span className="participation-icon"><Trophy size={23}/></span><div><h2 id="ranking-participation-title">Participação nos rankings</h2><p>Escolha quem participa dos cálculos comerciais, inclusive no TV Mode.</p></div><button type="button" className="button" onClick={() => { setMessage(''); load() }} disabled={loading || Boolean(busy)} aria-label="Atualizar lista de usuários"><RefreshCw size={15} className={loading ? 'participation-spin' : ''}/>Atualizar</button></div>
    <p className="participation-description">Heads e outras pessoas que não vendem podem ficar fora dos rankings, do acompanhamento de metas individuais e dos resultados por time. A conta mantém seus acessos, e as vendas registradas continuam nos totais financeiros gerais e por produto. Você pode incluir a pessoa novamente a qualquer momento.</p>
    {users && <div className="participation-summary" aria-label="Resumo da participação"><span><strong>{users.length - excluded}</strong> participam</span><span data-excluded="true"><strong>{excluded}</strong> excluídos dos cálculos</span></div>}
    <div className="participation-filters"><label className="participation-search"><span>Buscar usuário</span><div><Search size={17}/><input type="search" className="ds-input" aria-label="Buscar usuário" placeholder="Nome ou time" value={query} onChange={event => { setQuery(event.target.value); setLimit(50) }}/></div></label><label><span>Participação</span><select className="ds-input" aria-label="Filtrar participação" value={filter} onChange={event => { setFilter(event.target.value); setLimit(50) }}><option value="all">Todos os usuários</option><option value="included">Participam dos cálculos</option><option value="excluded">Excluídos dos cálculos</option></select></label></div>
    {message && <p className="participation-message" role="status"><Check size={17}/>{message}</p>}
    {error && <div className="notice notice-error" role="alert">{error}<button type="button" className="button" onClick={load} disabled={loading || Boolean(busy)}>Tentar novamente</button></div>}
    {loading && <p className="participation-loading" role="status"><LoaderCircle className="participation-spin" size={20}/>Carregando participação dos usuários…</p>}
    {users && <>
      <ul className="participation-list" aria-label="Usuários e participação nos cálculos" aria-busy={loading || Boolean(busy)}>
        {filtered.slice(0, limit).map(user => {
          const excluded = user.excludedFromRanking
          const action = excluded ? 'Incluir nos cálculos' : 'Excluir dos cálculos'
          const ActionIcon = excluded ? UserPlus : UserMinus
          return <li key={user.id} data-testid={`ranking-participation-user-${user.id}`}>
            <div className="participation-person"><span className="participation-avatar" aria-hidden="true">{user.name.trim().split(/\s+/).filter(Boolean).map(part => part[0]).slice(0, 2).join('').toLocaleUpperCase('pt-BR') || '?'}</span><div><strong>{user.name}</strong><small>{user.teamName || 'Sem time'}{user.active === false ? ' · Conta inativa' : ''}</small></div></div>
            <span className="participation-state" data-excluded={excluded}>{excluded ? 'Excluído' : 'Participa'}</span>
            <button type="button" className="button participation-action" aria-label={`${action}: ${user.name}`} disabled={loading || Boolean(busy)} onClick={() => change(user)}>{busy === user.id ? <LoaderCircle size={16} className="participation-spin"/> : <ActionIcon size={16}/>}<span>{busy === user.id ? 'Salvando…' : action}</span></button>
          </li>
        })}
      </ul>
      {!loading && !filtered.length && <p className="participation-empty">{users.length ? 'Nenhum usuário encontrado com estes filtros.' : 'Ainda não há usuários cadastrados no módulo comercial.'}</p>}
      {filtered.length > limit && <button type="button" className="button participation-more" onClick={() => setLimit(value => value + 50)}>Mostrar mais usuários ({filtered.length - limit} restantes)</button>}
    </>}
  </section>
}
