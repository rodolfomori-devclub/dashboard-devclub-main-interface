/* eslint-disable react/prop-types -- Private API-backed onboarding components. */
import { useMemo, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, BookOpen, Check, ChevronRight, ClipboardCheck, FileText, FolderOpen, GraduationCap, LoaderCircle, Search, ShieldCheck } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { requestApi } from '../lib/api'
import ResourceViewer from '../components/onboarding/ResourceViewer.jsx'
import '../components/onboarding/onboarding.css'

const TRACKS = [{ id: 'mba', label: 'Time MBA' }, { id: 'devclub', label: 'Time DevClub' }]
const FORMATS = { pdf: 'PDF', html: 'Interativo', markdown: 'Roteiro', mp4: 'Vídeo', link: 'Link externo' }
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

export default function OnboardingPage() {
  const { pathname } = useLocation()
  const track = pathname.split('/')[2]
  return <TrackWorkspace key={track} track={track}/>
}
function TrackWorkspace({ track }) {
  const { currentUser, hasPermission, userRoles } = useAuth()
  const [params, setParams] = useSearchParams()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [audience, setAudience] = useState('all')
  const [progressError, setProgressError] = useState('')
  const key = ['onboarding', currentUser.uid, track]
  const query = useQuery({ queryKey: key, queryFn: ({ signal }) => requestApi(`/onboarding/${track}`, { signal, cache: 'no-store' }), staleTime: 0 })
  const updateProgress = useMutation({
    mutationFn: ({ stepId, completed }) => requestApi(`/onboarding/${track}/progress/${encodeURIComponent(stepId)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ completed }) }),
    onMutate: async () => { setProgressError(''); await queryClient.cancelQueries({ queryKey: key }) },
    onSuccess: (result, variables) => queryClient.setQueryData(key, previous => {
      if (!previous) return previous
      const values = new Set(previous.completedStepIds)
      if (variables.completed) values.add(variables.stepId); else values.delete(variables.stepId)
      return { ...previous, completedStepIds: Array.isArray(result.completedStepIds) ? result.completedStepIds : [...values] }
    }),
    onError: error => setProgressError(error.message),
  })
  const data = query.data
  const completed = new Set(data?.completedStepIds || [])
  const steps = data?.modules.flatMap(module => module.steps) || []
  const done = steps.filter(step => completed.has(step.id)).length
  const nextStep = steps.find(step => !completed.has(step.id))
  const nextModule = data?.modules.find(module => module.steps.some(step => step.id === nextStep?.id))
  const activeModule = data?.modules.find(module => module.id === params.get('etapa')) || nextModule || data?.modules[0]
  const tab = ['biblioteca', 'revisao'].includes(params.get('aba')) ? params.get('aba') : 'trilha'
  const resources = useMemo(() => new Map((data?.resources || []).map(resource => [resource.id, resource])), [data])
  const activeResource = resources.get(params.get('material'))
  const categories = [...new Set((data?.resources || []).map(resource => resource.category))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  const filtered = (data?.resources || []).filter(resource => (category === 'all' || resource.category === category) && (audience === 'all' || resource.audience === audience) && normalize(`${resource.title} ${resource.description} ${resource.category}`).includes(normalize(search)))
  function changeParams(values) {
    setParams(previous => { const next = new URLSearchParams(previous); for (const [name, value] of Object.entries(values)) { if (value) next.set(name, value); else next.delete(name) } return next })
  }
  const openResource = (id, anchor) => changeParams({ material: id, trecho: anchor || null })
  if (query.isPending) return <div className="hub-page" role="status"><div className="skeleton skeleton-title"/><div className="skeleton skeleton-chart"/><span className="sr-only">Carregando onboarding…</span></div>
  if (query.isError) return <section className="surface-panel onboarding-error" role="alert"><BookOpen size={32}/><h1>Não foi possível abrir esta trilha</h1><p>{query.error.status === 403 ? 'Peça ao administrador para liberar o acesso a este time em Administração → Usuários e acessos.' : query.error.message}</p><button className="button" onClick={() => query.refetch()}>Tentar novamente</button></section>
  const notices = data.notices || []
  return <div className="hub-page onboarding-page">
    <header className="page-heading"><div><h1>Onboarding do time</h1><p>Aprenda a operação, pratique as conversas e tenha os materiais à mão.</p></div>{userRoles?.isAdmin && <Link className="button" to="/admin"><ShieldCheck size={17}/>Gerenciar acessos</Link>}</header>
    <nav className="onboarding-team-switch" aria-label="Times de onboarding">{TRACKS.filter(item => hasPermission(`onboarding-${item.id}`)).map(item => <Link key={item.id} to={`/onboarding/${item.id}`} aria-current={track === item.id ? 'page' : undefined}><GraduationCap size={18}/>{item.label}{track === item.id && <Check size={15}/>}</Link>)}</nav>
    <section className="onboarding-welcome" aria-labelledby="track-title">
      <div className="onboarding-welcome-copy"><span className="onboarding-team-label">{data.title}</span><h2 id="track-title">{done === steps.length ? 'Estudo concluído. A prática continua.' : done ? 'Continue de onde parou.' : 'Sua jornada começa aqui.'}</h2><p>{data.description}</p><small>Conteúdo-base de {data.sourceDate?.split('-').reverse().join('/') || '05/10/2026'} · {data.sourceAuthor || 'Time Comercial'}</small></div>
      <div className="onboarding-progress"><strong>{done}<span> / {steps.length}</span></strong><p>atividades concluídas</p><progress max={steps.length || 1} value={done} aria-label="Progresso da trilha"/><small>Salvo na sua conta</small></div>
    </section>
    <nav className="onboarding-tabs" aria-label="Conteúdo do onboarding">{[['trilha', 'Minha trilha', ClipboardCheck], ['biblioteca', 'Biblioteca do vendedor', FolderOpen], ['revisao', 'Pontos para confirmar', FileText]].map(([id, label, Icon]) => <button key={id} type="button" aria-current={tab === id ? 'page' : undefined} onClick={() => changeParams({ aba: id === 'trilha' ? null : id })}><Icon size={17}/>{label}{id === 'revisao' && notices.length > 0 && <span>{notices.length}</span>}</button>)}</nav>
    {tab === 'trilha' && <>
      {nextStep ? <div className="onboarding-next"><div><span>Próxima atividade</span><strong>{nextStep.title}</strong><p>{nextModule.title}</p></div><button className="button button-primary" onClick={() => { changeParams({ etapa: nextModule.id }); document.getElementById('onboarding-activities')?.scrollIntoView({ block: 'start', behavior: 'instant' }) }}>Continuar a trilha<ArrowRight size={17}/></button></div> : <div className="notice onboarding-finished"><Check size={22}/><p>Você concluiu as atividades de estudo. Confirme com a liderança a liberação para atender. A biblioteca continua disponível para consulta.</p></div>}
      <div className="onboarding-study">
        <nav className="onboarding-stages" aria-label="Etapas da trilha">{data.modules.map((module, index) => {
          const moduleDone = module.steps.filter(step => completed.has(step.id)).length
          return <button key={module.id} type="button" aria-current={activeModule.id === module.id ? 'step' : undefined} onClick={() => changeParams({ etapa: module.id })}><span className="onboarding-stage-number" data-complete={moduleDone === module.steps.length}>{moduleDone === module.steps.length ? <Check size={17}/> : index + 1}</span><span><strong>{module.title}</strong><small>{moduleDone} de {module.steps.length} atividades</small></span><ChevronRight size={16}/></button>
        })}</nav>
        <section className="surface-panel onboarding-activities" id="onboarding-activities" aria-labelledby="activities-title"><header><span>Etapa {data.modules.indexOf(activeModule) + 1} de {data.modules.length}</span><h2 id="activities-title">{activeModule.title}</h2><p>{activeModule.description}</p></header>
          {progressError && <p className="notice notice-error" role="alert">Não foi possível salvar. {progressError}</p>}
          <ol>{activeModule.steps.map(step => {
            const resource = resources.get(step.resourceId)
            const isDone = completed.has(step.id)
            const saving = updateProgress.isPending && updateProgress.variables?.stepId === step.id
            return <li key={step.id} data-complete={isDone}><label className="onboarding-step-check"><input type="checkbox" checked={isDone} disabled={updateProgress.isPending} onChange={event => updateProgress.mutate({ stepId: step.id, completed: event.target.checked })} aria-label={`Concluir: ${step.title}`}/>{saving ? <LoaderCircle size={17} className="onboarding-spin"/> : <Check size={17}/>}</label><div className="onboarding-step-content"><h3>{step.title}</h3><p>{step.description}</p>{step.completionAction && <p className="onboarding-step-action"><strong>Para concluir:</strong> {step.completionAction}</p>}{resource && <button className="onboarding-text-button" onClick={() => openResource(resource.id, step.anchor)}><BookOpen size={15}/>Abrir material<ChevronRight size={15}/></button>}{resource?.reviewNote && <small className="onboarding-review-flag">Contém pontos para confirmar com a liderança.</small>}</div></li>
          })}</ol><footer>Marque apenas o que já fez. A liderança confirma sua liberação para atendimento.</footer>
        </section>
      </div>
    </>}
    {tab === 'biblioteca' && <section aria-labelledby="library-title" className="onboarding-library"><div className="onboarding-section-heading"><div><h2 id="library-title">Materiais para estudar e vender</h2><p>Consulte quando precisar, durante e depois do onboarding.</p></div><span>{filtered.length} materiais</span></div><div className="onboarding-library-filters"><label className="onboarding-search"><span>Buscar material</span><div><Search size={17}/><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Script, ementa, objeção…"/></div></label><label><span>Categoria</span><select value={category} onChange={event => setCategory(event.target.value)}><option value="all">Todas</option>{categories.map(value => <option key={value}>{value}</option>)}</select></label><label><span>Uso do material</span><select value={audience} onChange={event => setAudience(event.target.value)}><option value="all">Todos</option><option value="internal">Uso interno</option><option value="lead">Pode enviar ao lead</option></select></label></div>
      {filtered.length ? <ul className="onboarding-resources">{filtered.map(resource => <li key={resource.id}><div className="onboarding-format">{FORMATS[resource.format] || 'Material'}</div><div className="onboarding-resource-copy"><h3><button onClick={() => openResource(resource.id)}>{resource.title}</button></h3><p>{resource.description}</p><div className="onboarding-resource-meta"><span>{resource.category}</span><span data-audience={resource.audience}>{resource.audience === 'lead' ? 'Pode enviar ao lead' : 'Uso interno'}</span>{resource.reviewNote && <span className="onboarding-review-flag">Conferir com a liderança</span>}</div></div><button className="icon-button" onClick={() => openResource(resource.id)} aria-label={`Abrir ${resource.title}`}><ArrowRight size={20}/></button></li>)}</ul> : <div className="surface-panel empty-state"><Search className="mx-auto"/><h3>Nenhum material encontrado</h3><p>Tente outro termo ou remova os filtros.</p><button className="button mt-4" onClick={() => { setSearch(''); setCategory('all'); setAudience('all') }}>Limpar filtros</button></div>}
    </section>}
    {tab === 'revisao' && <section className="surface-panel onboarding-review"><h2>Confirme antes de oferecer</h2><p>As fontes recebidas têm pontos em aberto e referências de campanhas anteriores. Use esta lista com a liderança; os materiais originais foram preservados.</p><ul>{notices.map((notice, index) => <li key={notice.id || index}><span>{index + 1}</span><div><h3>{typeof notice === 'string' ? notice : notice.title}</h3>{typeof notice !== 'string' && <p>{notice.description || notice.detail || notice.message}</p>}</div></li>)}</ul><p className="onboarding-review-owner">Confirme estes pontos com {data.sourceAuthor || 'a liderança do time'}.</p></section>}
    {activeResource && <ResourceViewer key={`${activeResource.id}:${params.get('trecho') || ''}`} track={track} catalog={data} resource={activeResource} anchor={params.get('trecho')} onClose={() => changeParams({ material: null, trecho: null })} onSelectResource={(id, anchor) => openResource(id, anchor)}/>}
    {params.get('material') && !activeResource && <div className="notice notice-error" role="alert">Este material não está disponível nesta trilha.<button className="button" onClick={() => changeParams({ material: null, trecho: null })}>Voltar</button></div>}
  </div>
}
