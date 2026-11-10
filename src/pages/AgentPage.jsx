/* eslint-disable react/prop-types -- Internal page components with explicit props. */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Bot, CircleAlert, MessageSquarePlus, RotateCcw, SendHorizontal, Square } from 'lucide-react'
import AgentBlock from '../components/agent/AgentBlock'
import { MAX_MESSAGE, announcement, canRetry, progressText } from '../components/agent/agentStream'
import { useAgentChat } from '../components/agent/useAgentChat'
import '../components/agent/agent.css'

const EXAMPLES = [
  'Compare novembro de 2025 com novembro de 2026',
  'Compare a semana do dia 3 de setembro com a semana do dia 7 de setembro',
  'Quais as vendas da Hotmart em 15 de outubro?',
  'Mostre nome, e-mail e telefone dos compradores deste mês',
]
const COMMENT_NOTE = 'Tabelas e gráficos vêm do servidor; o texto do agente é um comentário.'
const SWAP_GUARD_MS = 500

function AgentText({ text }) {
  return <div className="agent-text"><p className="agent-eyebrow">Leitura do agente</p>{text.split(/\n{2,}/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
}

function TurnFooter({ turn, busy, onRetry }) {
  const retry = label => <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => onRetry(turn.question)}><RotateCcw size={14} aria-hidden="true" />{label}</button>
  return <>
    {turn.unverifiedNumbers.length > 0 && <p className="notice agent-notice" role="note"><CircleAlert size={16} aria-hidden="true" /><span>{turn.unverifiedNumbers.length === 1 ? 'Este número não consta' : 'Estes números não constam'} nos dados calculados: {turn.unverifiedNumbers.join(', ')}. Confie nas tabelas.</span></p>}
    {turn.truncated && <p className="notice agent-notice"><CircleAlert size={16} aria-hidden="true" /><span>O comentário foi cortado antes do fim. Os blocos acima estão completos.</span></p>}
    {turn.pending && <div className="notice agent-action"><span>Histórico ainda carregando no servidor. Pergunte de novo em alguns minutos.</span>{retry('Perguntar de novo')}</div>}
    {turn.status === 'done' && !turn.parts.length && <p className="notice">O agente terminou sem resposta. Tente perguntar de outra forma.</p>}
    {turn.status === 'cancelled' && <p className="notice">{turn.error.message}</p>}
    {['error', 'interrupted'].includes(turn.status) && <div className="notice notice-error agent-action" role="alert"><span>{turn.error.message}</span>{canRetry(turn) && retry('Tentar de novo')}</div>}
  </>
}

function AssistantTurn({ turn, latest, busy, onRetry }) {
  return <div className={`agent-turn${latest ? ' is-latest' : ''}`} aria-busy={turn.status === 'streaming'}>
    {turn.parts.map((part, index) => {
      if (part.type === 'block') return <AgentBlock key={part.block.blockId} block={part.block} />
      if (part.type === 'text') return <AgentText key={index} text={part.text} />
      return <p key={index} className="agent-muted agent-tool-error">Consulta recusada: {part.message}</p>
    })}
    <TurnFooter turn={turn} busy={busy} onRetry={onRetry} />
  </div>
}

function EmptyState({ onPick }) {
  return <section className="agent-empty ds-card">
    <span className="agent-empty-icon"><Bot size={26} aria-hidden="true" /></span>
    <h2>O que você quer comparar?</h2>
    <p className="agent-muted">Pergunte por datas, semanas, meses ou plataformas. Consulte também nome, e-mail e telefone dos compradores, com downloads em XLSX e CSV.</p>
    <div className="agent-examples">{EXAMPLES.map(example => <button key={example} type="button" className="btn btn-ghost" onClick={() => onPick(example)}>{example}</button>)}</div>
    <p className="agent-muted">A conversa não é salva. {COMMENT_NOTE}</p>
  </section>
}

export default function AgentPage() {
  const { messages, stalled, send, stop, reset } = useAgentChat()
  const [draft, setDraft] = useState('')
  const input = useRef(null)
  const latestQuestion = useRef(null)
  const page = useRef(null)
  const dock = useRef(null)
  const answerEndedAt = useRef(0)
  const refocus = useRef(false)
  const refocusedAt = useRef(0)
  const lastTurn = messages.at(-1)
  const lastQuestionId = messages.at(-2)?.id
  const busy = lastTurn?.status === 'streaming'

  // The answer is read from its start, so the view stays on the question instead of following the text.
  useEffect(() => { if (lastQuestionId) latestQuestion.current?.scrollIntoView({ block: 'start' }) }, [lastQuestionId])
  useEffect(() => {
    if (busy) return
    answerEndedAt.current = performance.now()
    if (refocus.current) { refocus.current = false; refocusedAt.current = performance.now(); input.current?.focus() }
  }, [busy])
  // A focused control must clear the composer, whatever height it has right now.
  useEffect(() => {
    const node = dock.current
    if (!node || typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(() => page.current?.style.setProperty('--agent-dock-height', `${node.offsetHeight}px`))
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  // Runs while the button is still in the page: if it held focus, focus would fall to the body.
  const stopButton = useCallback(node => () => { refocus.current = document.activeElement === node }, [])

  function submit(event) {
    event?.preventDefault()
    if (busy || !draft.trim()) return
    send(draft)
    setDraft('')
    input.current?.focus()
  }
  function ask(question) {
    send(question)
    input.current?.focus()
  }
  function keyDown(event) {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
    // Enter aimed at Parar, held or a moment late, must not send the draft that focus just landed on.
    if (event.repeat || performance.now() - refocusedAt.current < SWAP_GUARD_MS) event.preventDefault()
    else submit(event)
  }
  // Parar and Enviar swap in one spot. The second click of a double click, or a click meant
  // for Parar that lands just after the answer ended, was not aimed at the new button.
  // Keyboard activation has detail 0.
  function stopAnswer(event) {
    if (event.detail > 1) return
    stop()
    refocusedAt.current = performance.now()
    input.current?.focus()
  }
  function guardSend(event) {
    if (event.detail > 1 || (event.detail === 1 && performance.now() - answerEndedAt.current < SWAP_GUARD_MS)) event.preventDefault()
  }
  // Charts use Escape for themselves; the mobile menu sits outside this page.
  function pageKeyDown(event) {
    if (event.key === 'Escape' && busy && !event.target.closest('.rr-chart-plot')) stop()
  }

  return <div className="hub-page agent-page" ref={page} onKeyDown={pageKeyDown}>
    <header className="page-heading">
      <div><h1>Agente</h1><p>Comparativos e consultas de vendas em linguagem natural.</p></div>
      {messages.length > 0 && <button type="button" className="btn btn-ghost" onClick={() => { reset(); setDraft(''); input.current?.focus() }}><MessageSquarePlus size={15} aria-hidden="true" />Nova conversa</button>}
    </header>
    {messages.length === 0 ? <EmptyState onPick={ask} /> : <>
      <div className="agent-conversation" role="log" aria-label="Conversa com o agente">
        {messages.map((message, index) => message.role === 'user'
          ? <div key={message.id} className="agent-user" ref={index === messages.length - 2 ? latestQuestion : undefined}>{message.text}</div>
          : <AssistantTurn key={message.id} turn={message} latest={index === messages.length - 1} busy={busy} onRetry={ask} />)}
      </div>
    </>}
    {/* A mouse press here leaves focus in the composer, so typing is never caught by the button that took its place. */}
    <div className="agent-dock" ref={dock} onMouseDown={event => { if (event.target !== input.current) event.preventDefault() }}>
      {busy && <p className="agent-progress"><span className="agent-spinner" aria-hidden="true" />{progressText(lastTurn, stalled)}</p>}
      <form className="agent-composer ds-card" onSubmit={submit}>
        <textarea ref={input} className="ds-input" rows={2} maxLength={MAX_MESSAGE} aria-label="Pergunta para o agente" placeholder="Ex.: compare outubro com setembro, só Hotmart" value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={keyDown} />
        <div className="agent-composer-actions">
          <p className="agent-muted">{messages.length > 0 ? COMMENT_NOTE : 'Enter envia. Shift + Enter quebra a linha.'}</p>
          {/* Distinct keys: reusing one node would turn the click on Parar into a submit of the draft.
              Not disabled: a disabled button gets no mousedown, and the press would take focus from the composer. */}
          {busy
            ? <button key="stop" ref={stopButton} type="button" className="btn btn-ghost" onClick={stopAnswer}><Square size={14} aria-hidden="true" />Parar</button>
            : <button key="send" type="submit" className="btn btn-primary" aria-disabled={!draft.trim()} onClick={guardSend}><SendHorizontal size={15} aria-hidden="true" />Enviar</button>}
        </div>
      </form>
    </div>
    <p className="agent-sr-only" role="status">{announcement(lastTurn, stalled)}</p>
  </div>
}
