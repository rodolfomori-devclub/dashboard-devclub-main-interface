import { useCallback, useEffect, useRef, useState } from 'react'
import { ShieldCheck, ExternalLink } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import RankingParticipation from '../components/admin/RankingParticipation'
import UserManagement from '../components/admin/UserManagement'
import { requestApi } from '../lib/api'

export default function AdminPage() {
  const { reload } = useAuth()
  const [directoryVersion, setDirectoryVersion] = useState(0)
  const vaultUrl = import.meta.env.VITE_VAULT_HUB_URL || 'http://localhost:5173'
  return <div className="hub-page">
    <header className="page-heading"><div><h1>Administração</h1><p>Cadastre sua equipe, defina os acessos e organize a participação nos indicadores.</p></div><a className="button" href={vaultUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={17}/>Abrir Vault</a></header>
    <UserManagement onDirectoryChange={() => setDirectoryVersion(value => value + 1)}/>
    <RankingParticipation refreshKey={directoryVersion}/>
    <McpConnections />
    <section className="surface-panel"><div className="flex items-start gap-4"><ShieldCheck className="text-primary" size={27}/><div><h2 className="text-lg">Uma conta, acessos organizados</h2><p className="text-muted-foreground text-sm mt-2 max-w-3xl">Os cadastros feitos aqui são registrados no Vault. O perfil e as telas escolhidas valem para o Dashboard; a gestão dos demais sistemas continua no Vault. As permissões controlam os menus e os dados disponíveis.</p><button className="button mt-5" onClick={reload}>Atualizar minhas permissões</button></div></div></section>
  </div>
}

function McpConnections() {
  const { currentUser, userRoles } = useAuth()
  const [enabled, setEnabled] = useState(false), [connections, setConnections] = useState([])
  const [loading, setLoading] = useState(false), [busy, setBusy] = useState(''), [error, setError] = useState(''), [message, setMessage] = useState('')
  const mounted = useRef(false), currentLoad = useRef(null), saving = useRef(false)
  const load = useCallback(async () => {
    currentLoad.current?.abort()
    const controller = new AbortController()
    currentLoad.current = controller
    setLoading(true); setError('')
    try {
      const status = await requestApi('/mcp/status', { signal: controller.signal })
      if (controller.signal.aborted || !mounted.current) return
      setEnabled(status.enabled === true)
      if (!status.enabled) { setConnections([]); return }
      const result = await requestApi('/mcp/connections', { signal: controller.signal })
      if (!Array.isArray(result.connections)) throw new Error('Não foi possível consultar suas conexões. Tente novamente.')
      if (!controller.signal.aborted && mounted.current) setConnections(result.connections)
    } catch (failure) {
      if (!controller.signal.aborted && mounted.current) {
        if (failure.status === 404) { setEnabled(false); setConnections([]) } else setError(failure.message)
      }
    } finally { if (!controller.signal.aborted && mounted.current) setLoading(false) }
  }, [])
  useEffect(() => {
    mounted.current = true
    setConnections([]); setMessage(''); setError(''); setEnabled(false)
    if (userRoles?.isAdmin) void load()
    return () => { mounted.current = false; currentLoad.current?.abort() }
  }, [load, currentUser?.uid, userRoles?.isAdmin])
  async function disconnect(connection) {
    if (saving.current) return
    saving.current = true; setBusy(connection.id); setError(''); setMessage('')
    try {
      await requestApi(`/mcp/connections/${encodeURIComponent(connection.id)}`, { method: 'DELETE' })
      if (mounted.current) {
        setConnections(previous => previous.filter(item => item.id !== connection.id))
        setMessage('Conexão desconectada. Para voltar a usar o Claude, conecte sua conta novamente.')
      }
    } catch (failure) { if (mounted.current) setError(failure.message) }
    finally { saving.current = false; if (mounted.current) setBusy('') }
  }
  if (!userRoles?.isAdmin || (!enabled && !error)) return null
  const date = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'Não informado'
  return <section className="surface-panel space-y-4" aria-label="Minhas conexões do Claude" aria-busy={loading || Boolean(busy)}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg">Minhas conexões do Claude</h2><p className="text-sm text-muted-foreground mt-2">Consulte os acessos vinculados à sua conta. Desconectar bloqueia novas consultas e aprovações desta conexão.</p></div><button type="button" className="button" disabled={loading || Boolean(busy)} onClick={load}>Atualizar conexões</button></div>
    {error && <p role="alert" className="notice notice-error">{error}</p>}
    {message && <p role="status" className="text-sm">{message}</p>}
    {loading && <p role="status" className="text-sm text-muted-foreground">Consultando suas conexões…</p>}
    {!loading && !connections.length && !error && <p className="text-sm text-muted-foreground">Nenhuma conexão ativa com sua conta.</p>}
    <ul className="space-y-3">{connections.map(connection => {
      const active = !connection.revokedAt && Date.parse(connection.expiresAt) > Date.now()
      return <li key={connection.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"><div><strong>{connection.clientName || 'Claude'}</strong><p className="text-sm text-muted-foreground mt-1">{connection.scopes?.includes('goals.propose') ? 'Consultas e propostas de metas' : 'Consultas agregadas'}{connection.scopes?.includes('buyers.read') && ' · Contatos de compradores'} · {active ? `Válida até ${date(connection.expiresAt)}` : connection.revokedAt ? 'Desconectada' : 'Expirada'}</p><p className="text-xs text-muted-foreground mt-1">Conectada em {date(connection.createdAt)} · Último uso: {date(connection.lastUsedAt)}</p></div>{active && <button type="button" className="button" disabled={loading || Boolean(busy)} onClick={() => disconnect(connection)}>{busy === connection.id ? 'Desconectando…' : 'Desconectar'}</button>}</li>
    })}</ul>
  </section>
}
