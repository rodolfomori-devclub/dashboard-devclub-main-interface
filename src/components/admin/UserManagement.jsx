/* eslint-disable react/prop-types -- Admin-only composition; API validates all assignments. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Check, Copy, LoaderCircle, Pencil, RefreshCw, ShieldCheck, UserPlus, Users, X } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../contexts/AuthContext'
import { requestApi } from '../../lib/api'
import { NAVIGATION, SCREENS } from '../../lib/navigation'
import './userManagement.css'

const SELLER_SCREENS = ['hub-home', 'daily-kpis', 'daily-checklist', 'commissions', 'materials', 'sales-links', 'ranking']
const screenCatalog = new Map(NAVIGATION.flatMap(({ group, items }) => items.map(item => [item.permission, { id: item.permission, label: item.label, group }])))
const knownScreens = new Set(SCREENS.filter(screen => screen.permission !== 'admin').map(screen => screen.permission))
const validUser = user => user && typeof user.id === 'string' && typeof user.name === 'string'
  && typeof user.email === 'string' && typeof user.isAdmin === 'boolean'
  && Array.isArray(user.permissions) && typeof user.revision === 'string'
const jsonOptions = body => ({ headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const failureText = error => ({
  USER_ALREADY_HAS_ACCESS: 'Este e-mail já tem acesso ao Dashboard. Feche o cadastro, encontre a conta na lista e use “Editar acessos”.',
  DASHBOARD_ACCESS_CONFLICT: 'Os acessos foram alterados por outro administrador. Feche este formulário e reabra a conta na lista atualizada.',
  SELF_ACCESS_CHANGE_DENIED: 'Seus próprios acessos devem ser alterados por outro administrador.',
  IDEMPOTENCY_CONFLICT: 'Esta tentativa já foi registrada com outros dados. Atualize a lista antes de iniciar outro cadastro.',
}[error.code] || error.message)

// Generated once per attempt, retained only in memory, and never saved in browser storage.
function temporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*'
  const random = crypto.getRandomValues(new Uint8Array(24))
  return `Aa7!${Array.from(random, value => alphabet[value % alphabet.length]).join('')}`
}

export default function UserManagement({ onDirectoryChange }) {
  const { currentUser } = useAuth()
  const queryClient = useQueryClient()
  const [catalog, setCatalog] = useState(null)
  const [catalogError, setCatalogError] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState('')
  const [editor, setEditor] = useState(null)
  const [version, setVersion] = useState(0)
  const mounted = useRef(false)
  const syncLock = useRef(false)
  const loadCatalog = useCallback(async signal => {
    setCatalogError('')
    try {
      const data = await requestApi('/admin/users/catalog', { signal, cache: 'no-store' })
      if (!Array.isArray(data.permissions) || !data.permissions.every(item => knownScreens.has(item.id) && typeof item.label === 'string') || !Array.isArray(data.teams)) throw new Error('Não foi possível carregar as opções de acesso.')
      if (mounted.current && !signal?.aborted) setCatalog({ ...data, permissions: [...screenCatalog.values()].filter(item => data.permissions.some(allowed => allowed.id === item.id)) })
    } catch (failure) { if (mounted.current && !signal?.aborted) setCatalogError(failure.message) }
  }, [])
  useEffect(() => {
    mounted.current = true
    const controller = new AbortController()
    loadCatalog(controller.signal)
    return () => { mounted.current = false; controller.abort() }
  }, [loadCatalog])
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError('')
    const timer = setTimeout(async () => {
      try {
        const data = await requestApi(`/admin/users?page=${page}&limit=20&search=${encodeURIComponent(query.trim())}`, { signal: controller.signal, cache: 'no-store' })
        if (!Array.isArray(data.users) || !data.users.every(validUser) || !Number.isSafeInteger(data.total)) throw new Error('Não foi possível validar a lista de contas.')
        if (!controller.signal.aborted) setResult(data)
      } catch (failure) { if (!controller.signal.aborted) setError(failure.message) }
      finally { if (!controller.signal.aborted) setLoading(false) }
    }, query ? 250 : 0)
    return () => { clearTimeout(timer); controller.abort() }
  }, [query, page, version])
  const refresh = () => setVersion(value => value + 1)
  const directoryChanged = () => { refresh(); queryClient.invalidateQueries({ queryKey: ['profiles'] }); onDirectoryChange?.() }
  const syncProfile = async user => {
    if (syncLock.current) return
    syncLock.current = true; setSyncing(user.id); setError(''); setNotice('')
    try {
      const data = await requestApi(`/admin/users/${encodeURIComponent(user.id)}/sync-profile`, { method: 'POST', ...jsonOptions({ requestId: user.hub.requestId }) })
      if (data.hub?.status !== 'ready') throw new Error(data.hub?.error || 'O perfil comercial ainda está pendente. Tente novamente em instantes.')
      if (mounted.current) { setNotice(`Cadastro comercial de ${user.name} concluído.`); directoryChanged() }
    } catch (failure) { if (mounted.current) { setError(failureText(failure)); refresh() } }
    finally { syncLock.current = false; if (mounted.current) setSyncing('') }
  }

  return <section className="surface-panel admin-users" data-testid="admin-users" aria-labelledby="admin-users-title">
    <div className="admin-users-heading"><span className="admin-users-icon"><Users size={24}/></span><div><h2 id="admin-users-title">Usuários e acessos</h2><p>A equipe entra por aqui. O Vault cuida da conta.</p></div><button className="button button-primary" disabled={!catalog} onClick={() => setEditor({ mode: 'create' })}><UserPlus size={17}/>Adicionar usuário</button></div>
    <p className="admin-users-description">Crie um vendedor ou administrador e escolha as telas que ele poderá acessar. Se o e-mail já estiver no Vault, vinculamos a conta existente ao Dashboard.</p>
    {catalogError && <div className="notice notice-error" role="alert">{catalogError}<button className="button" onClick={() => loadCatalog()}>Recarregar opções</button></div>}
    <div className="admin-users-toolbar"><label><span>Buscar conta</span><input type="search" className="ds-input" placeholder="Nome ou e-mail" maxLength={200} value={query} onChange={event => { setQuery(event.target.value); setPage(1) }}/></label><button className="button" disabled={loading} onClick={refresh} aria-label="Atualizar contas"><RefreshCw size={16} className={loading ? 'participation-spin' : ''}/>Atualizar</button></div>
    {notice && <p className="admin-users-success" role="status"><Check size={17}/>{notice}</p>}
    {error && <div className="notice notice-error" role="alert">{error}<button className="button" onClick={refresh}>Tentar novamente</button></div>}
    {loading && <p className="admin-users-loading" role="status"><LoaderCircle size={19} className="participation-spin"/>Carregando contas e acessos…</p>}
    <ul className="admin-users-list" aria-label="Contas com acesso ao Dashboard" aria-busy={loading}>
      {result?.users.map(user => <li key={user.id} data-testid={`admin-user-${user.id}`}>
        <div className="admin-user-identity"><strong>{user.name}{user.id === currentUser?.uid && <small>Você</small>}</strong><span>{user.email}</span></div>
        <div className="admin-user-access"><span className="admin-user-badge" data-admin={user.isAdmin}>{user.isAdmin ? 'Administrador' : 'Usuário'}</span><small>{user.active === false ? 'Conta inativa no Vault' : user.isAdmin ? 'Todas as telas' : `${user.permissions.length} ${user.permissions.length === 1 ? 'tela liberada' : 'telas liberadas'}`}</small></div>
        <div className="admin-user-actions">{user.hub?.status === 'pending' && <small className="admin-user-pending">{user.hub.error || 'Cadastro comercial pendente.'}</small>}{user.hub?.status === 'pending' && user.hub.requestId && <button className="button" disabled={Boolean(syncing) || user.hub.retryable === false} onClick={() => syncProfile(user)}>{syncing === user.id ? <LoaderCircle size={15} className="participation-spin"/> : <RefreshCw size={15}/>}Concluir cadastro comercial</button>}<button className="button" aria-label={`Editar acessos: ${user.name}`} disabled={!catalog || loading || user.active === false || user.id === currentUser?.uid} title={user.id === currentUser?.uid ? 'Outro administrador pode alterar seus acessos.' : undefined} onClick={() => setEditor({ mode: 'edit', user })}><Pencil size={15}/>Editar acessos</button></div>
      </li>)}
    </ul>
    {!loading && result && !result.users.length && <p className="admin-users-empty">{query ? 'Nenhuma conta encontrada.' : 'Ainda não há contas para exibir.'}</p>}
    {result && <div className="admin-users-pagination"><span>{result.total} {result.total === 1 ? 'conta' : 'contas'} no Dashboard</span><div><button className="button" disabled={loading || page === 1} onClick={() => setPage(value => value - 1)}>Anterior</button><span>Página {page} de {Math.max(1, result.totalPages || 1)}</span><button className="button" disabled={loading || page >= (result.totalPages || 1)} onClick={() => setPage(value => value + 1)}>Próxima</button></div></div>}
    {editor && catalog && <UserEditor editor={editor} catalog={catalog} onClose={() => { setEditor(null); refresh() }} onSaved={directoryChanged} onConflict={refresh}/>}
  </section>
}

function UserEditor({ editor, catalog, onClose, onSaved, onConflict }) {
  const editing = editor.mode === 'edit'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [isAdmin, setIsAdmin] = useState(editing ? editor.user.isAdmin : false)
  const [permissions, setPermissions] = useState(editing ? editor.user.permissions.filter(value => knownScreens.has(value)) : SELLER_SCREENS.filter(value => catalog.permissions.some(item => item.id === value)))
  const [teamId, setTeamId] = useState('')
  const [participates, setParticipates] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(null)
  const [copied, setCopied] = useState(false)
  const attempt = useRef(null)
  const saving = useRef(false)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => { alive.current = false; attempt.current = null }
  }, [])
  const locked = busy || Boolean(attempt.current)
  const groups = useMemo(() => Object.entries(catalog.permissions.reduce((groups, item) => { (groups[item.group || 'Telas'] ||= []).push(item); return groups }, {})), [catalog.permissions])
  const toggle = id => setPermissions(values => values.includes(id) ? values.filter(value => value !== id) : [...values, id])
  const submit = async event => {
    event.preventDefault()
    if (saving.current) return
    if (!editing && name.trim().length < 2) { setError('Informe o nome completo com pelo menos dois caracteres.'); return }
    if (!isAdmin && !permissions.length) { setError('Selecione pelo menos uma tela para este usuário.'); return }
    saving.current = true; setBusy(true); setError('')
    try {
      if (!editing && !attempt.current) attempt.current = { key: crypto.randomUUID(), body: { name: name.trim(), email: email.trim().toLowerCase(), password: temporaryPassword(), isAdmin, permissions: isAdmin ? [] : permissions, teamId: teamId || null, excludedFromRanking: !participates } }
      const response = editing
        ? await requestApi(`/admin/users/${encodeURIComponent(editor.user.id)}/access`, { method: 'PUT', ...jsonOptions({ isAdmin, permissions: isAdmin ? [] : permissions, expectedRevision: editor.user.revision }) })
        : await requestApi('/admin/users', { method: 'POST', ...jsonOptions(attempt.current.body), headers: { 'Content-Type': 'application/json', 'Idempotency-Key': attempt.current.key } })
      if (!validUser(response.user) || (!editing && typeof response.created !== 'boolean')) throw new Error('O servidor não confirmou o cadastro. Tente novamente com os mesmos dados.')
      if (alive.current) {
        setSuccess({ ...response, password: !editing && response.created ? attempt.current.body.password : null })
        attempt.current = null
        onSaved()
      }
    } catch (failure) {
      if (alive.current) {
        if (failure.status === 400) attempt.current = null
        setError(failureText(failure)); if (failure.status === 409) onConflict()
      }
    } finally { saving.current = false; if (alive.current) setBusy(false) }
  }
  const copyPassword = async () => {
    try { await navigator.clipboard.writeText(success.password); setCopied(true) }
    catch { setError('Selecione e copie a senha exibida abaixo.') }
  }
  return <Dialog.Root open onOpenChange={open => { if (!open && !busy) onClose() }}>
    <Dialog.Portal><Dialog.Overlay className="admin-user-overlay"/><Dialog.Content className="admin-user-dialog" aria-label={editing ? `Editar acessos de ${editor.user.name}` : 'Adicionar usuário'} onInteractOutside={event => event.preventDefault()} onEscapeKeyDown={event => { if (busy) event.preventDefault() }}>
      <header><div><span className="admin-user-eyebrow">EQUIPE · DASHBOARD</span><Dialog.Title>{success ? editing ? 'Acessos atualizados' : success.created ? 'Conta criada no Vault' : 'Conta vinculada ao Dashboard' : editing ? `Acessos de ${editor.user.name}` : 'Adicionar usuário'}</Dialog.Title></div><Dialog.Close className="admin-user-close" disabled={busy} aria-label="Fechar cadastro"><X size={21}/></Dialog.Close></header>
      <Dialog.Description className="admin-user-description">{success ? 'O perfil e as telas foram registrados no Vault.' : editing ? 'Defina o que esta pessoa pode acessar no Dashboard.' : 'Cadastre a pessoa, escolha seu perfil e libere as telas necessárias.'}</Dialog.Description>
      {success ? <div className="admin-user-complete">
        <div className="admin-user-confirmation"><ShieldCheck size={26}/><div><strong>{success.user.name}</strong><span>{success.user.email}</span></div></div>
        {success.password ? <><p>Envie a senha temporária para a pessoa por um canal privado. Ela deverá criar uma nova senha no primeiro acesso ao Vault. Nenhum e-mail é enviado automaticamente.</p><label className="admin-user-password"><span>Senha temporária</span><input className="ds-input" aria-label="Senha temporária" value={success.password} readOnly autoComplete="off"/><button className="button" onClick={copyPassword}><Copy size={16}/>{copied ? 'Senha copiada' : 'Copiar senha'}</button></label><small>A senha aparece apenas nesta confirmação. Copie antes de fechar.</small></> : !editing && <p>Esta pessoa já tinha uma conta no Vault e usará a senha que já possui.</p>}
        {!editing && <p>O acesso começa em <a href={success.loginUrl || catalog.loginUrl || import.meta.env.VITE_VAULT_HUB_URL} target="_blank" rel="noopener noreferrer">Abrir Vault</a>. Depois, basta abrir o Dashboard.</p>}
        {success.hub?.status === 'pending' && <div className="notice" role="status">A conta e os acessos estão salvos. O cadastro comercial ainda está pendente: {success.hub.error || 'a conexão com o módulo comercial não foi concluída.'} Feche esta confirmação e use “Concluir cadastro comercial” na lista.</div>}
        {error && <p role="alert">{error}</p>}
        <button className="button button-primary" onClick={onClose}>Concluir</button>
      </div> : <form onSubmit={submit} aria-label={editing ? 'Editar acessos' : 'Adicionar usuário'}>
        <fieldset disabled={locked} className="admin-user-fields">
          {!editing && <div className="admin-user-grid"><label><span>Nome completo</span><input className="ds-input" value={name} onChange={event => setName(event.target.value)} autoComplete="off" required minLength={2} maxLength={120}/></label><label><span>E-mail</span><input type="email" className="ds-input" value={email} onChange={event => setEmail(event.target.value)} autoComplete="off" required maxLength={254}/></label></div>}
          <label><span>Perfil do Dashboard</span><select className="ds-input" value={isAdmin ? 'admin' : 'user'} onChange={event => setIsAdmin(event.target.value === 'admin')}><option value="user">Usuário — telas selecionadas</option><option value="admin">Administrador — gestão completa</option></select></label>
          {isAdmin ? <div className="admin-user-role-note"><ShieldCheck size={20}/><p>Administrador acessa todas as telas e gerencia usuários e configurações do Dashboard. Esse perfil não concede administração dos outros sistemas no Vault.</p></div> : <div className="admin-user-menus"><div><h3>Telas permitidas</h3><span>{permissions.length} selecionadas</span></div><div className="admin-user-presets"><button type="button" className="button" onClick={() => setPermissions(SELLER_SCREENS.filter(id => catalog.permissions.some(item => item.id === id)))}>Padrão vendedor</button><button type="button" className="button" onClick={() => setPermissions(catalog.permissions.map(item => item.id))}>Selecionar todas</button><button type="button" className="button" onClick={() => setPermissions([])}>Limpar seleção</button></div>{groups.map(([group, items]) => <fieldset key={group} className="admin-user-menu-group"><legend>{group}</legend><div>{items.map(item => <label key={item.id}><input type="checkbox" checked={permissions.includes(item.id)} onChange={() => toggle(item.id)}/><span>{item.label}</span></label>)}</div></fieldset>)}</div>}
          {!editing && <div className="admin-user-commercial"><label><span>Time</span><select className="ds-input" value={teamId} onChange={event => setTeamId(event.target.value)}><option value="">Sem time</option>{catalog.teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label><label className="admin-user-participation"><input type="checkbox" checked={participates} onChange={event => setParticipates(event.target.checked)}/><span>Participa dos rankings<small>Desmarque para heads e outras pessoas que não vendem.</small></span></label>{catalog.teamsUnavailable === true && <p role="status">Times temporariamente indisponíveis. Você poderá definir o time depois.</p>}</div>}
        </fieldset>
        {error && <div className="notice notice-error" role="alert">{error}</div>}
        {attempt.current && !busy && <p className="admin-user-retry-note">Os dados desta tentativa foram mantidos para que você possa tentar novamente sem duplicar a conta.</p>}
        <footer><button type="button" className="button" disabled={busy} onClick={onClose}>Cancelar</button><button type="submit" className="button button-primary" disabled={busy}>{busy && <LoaderCircle size={17} className="participation-spin"/>}{busy ? 'Salvando…' : editing ? 'Salvar acessos' : 'Criar usuário'}</button></footer>
      </form>}
    </Dialog.Content></Dialog.Portal>
  </Dialog.Root>
}
