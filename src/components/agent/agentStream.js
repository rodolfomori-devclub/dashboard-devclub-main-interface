// The tested contract with POST /api/agent/messages. No React and no session here.
export const MAX_MESSAGE = 2000
// The API accepts 24 items of 4000 characters. Its 100 kB JSON limit counts bytes, so accented
// text can pass it at those sizes: the byte cap is what keeps a long history under the limit.
const MAX_HISTORY_TEXT = 4000, MAX_HISTORY_ITEMS = 24, MAX_HISTORY_BYTES = 80_000
const END_MESSAGES = {
  cancelled: 'Interrompido. O que já chegou foi mantido.',
  interrupted: 'A conexão caiu antes do fim da resposta. O que já chegou foi mantido.',
}
const HTTP_MESSAGES = {
  401: 'Entre novamente pelo Vault para renovar sua sessão.',
  403: 'Seu acesso não inclui as telas financeiras que o agente consulta. Um administrador pode liberar em Administração → Usuários e acessos.',
  413: 'A conversa ficou longa demais. Inicie uma nova conversa.',
  429: 'Muitas perguntas em sequência. Aguarde alguns segundos e tente novamente.',
  503: 'O agente está indisponível no momento. Tente novamente em instantes.',
}
// Asking again cannot change the outcome of these.
const FINAL_CODES = new Set(['AGENT_REFUSED', 'AGENT_CONVERSATION_FULL', 'AGENT_BUDGET_EXCEEDED', 'AGENT_MESSAGE_INVALID'])

const STALLED_MESSAGE = 'Sem resposta do servidor há alguns instantes. Você pode aguardar ou parar.'
export const progressText = (turn, stalled) => stalled ? STALLED_MESSAGE : turn.activity || 'Analisando a pergunta…'
// One announcement per phase: status lines change every two seconds while a month loads.
export function announcement(turn, stalled) {
  if (!turn) return ''
  if (turn.status === 'streaming') return stalled ? STALLED_MESSAGE : turn.calls.at(-1)?.label ?? 'Analisando a pergunta.'
  if (turn.status === 'done') return 'Resposta pronta.'
  return turn.error?.message ?? ''
}

/** A session renewal that hangs ignores the signal, and stopping must still end the turn. */
export function untilAborted(task, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new DOMException('Aborted', 'AbortError'))
    if (signal.aborted) abort()
    signal.addEventListener('abort', abort, { once: true })
    task.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
  })
}

export const canRetry = turn => turn.status === 'interrupted' || (turn.status === 'error' && turn.error?.status !== 403 && !FINAL_CODES.has(turn.error?.code))

/** One JSON event per line. A line may arrive split across chunks, and the last may lack its newline. */
export async function readNdjson(body, onEvent) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const flush = line => { if (line.trim()) onEvent(JSON.parse(line)) }
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop()
    lines.forEach(flush)
  }
  flush(buffer + decoder.decode())
}

export const newTurn = (id, question) => ({ id, role: 'assistant', question, status: 'streaming', parts: [], calls: [], activity: '', error: null, truncated: false, pending: false, unverifiedNumbers: [] })

export function reduceAgentEvent(turn, event) {
  if (turn.status !== 'streaming') return turn
  switch (event?.type) {
    case 'text': {
      const last = turn.parts.at(-1)
      const parts = last?.type === 'text' ? [...turn.parts.slice(0, -1), { ...last, text: last.text + event.delta }] : [...turn.parts, { type: 'text', text: event.delta }]
      return { ...turn, parts, activity: '' }
    }
    case 'tool_start': return { ...turn, calls: [...turn.calls, { id: event.callId, label: event.label }], activity: event.label }
    case 'status': return { ...turn, activity: event.text }
    case 'block': return { ...turn, parts: [...turn.parts, { type: 'block', block: event.block }], activity: '' }
    case 'tool_error': return { ...turn, parts: [...turn.parts, { type: 'tool_error', message: event.message }], activity: '' }
    case 'done': return { ...turn, status: 'done', activity: '', truncated: event.truncated === true, pending: event.pending === true, unverifiedNumbers: event.unverifiedNumbers ?? [] }
    case 'error': return { ...turn, status: 'error', activity: '', error: { code: event.code, message: event.error }, unverifiedNumbers: event.unverifiedNumbers ?? [] }
    default: return turn
  }
}

/** A stream that ends without `done` or `error` was cut, never completed. */
export const endTurn = (turn, reason) => turn.status === 'streaming' ? { ...turn, status: reason, activity: '', error: { message: END_MESSAGES[reason] } } : turn

export function failedRequest(status, data = {}, sessionMessages = {}) {
  const code = typeof data?.code === 'string' ? data.code : ''
  const message = sessionMessages[code] || (code.startsWith('AGENT_') && typeof data.error === 'string' && data.error) || HTTP_MESSAGES[status] || `Não foi possível falar com o agente (${status}).`
  return { status, code, message }
}
export const failTurn = (turn, error) => ({ ...turn, status: 'error', activity: '', error })

function assistantText(turn) {
  const consultas = turn.calls.length ? `\n\n[Consultas feitas: ${turn.calls.map(call => call.label).join('; ')}]` : ''
  const text = turn.parts.filter(part => part.type === 'text').map(part => part.text).join('\n\n').trim()
  return `${(text || 'Resposta sem comentário em texto.').slice(0, Math.max(0, MAX_HISTORY_TEXT - consultas.length))}${consultas}`.slice(0, MAX_HISTORY_TEXT)
}

/**
 * Only finished turns go back, as plain text with the periods they consulted.
 * The API recalculates every number, so a cancelled or failed turn adds nothing.
 */
export function buildHistory(messages) {
  const pairs = []
  messages.forEach((message, index) => {
    const answer = messages[index + 1]
    if (message.role === 'user' && answer?.role === 'assistant' && answer.status === 'done') {
      pairs.push([{ role: 'user', text: message.text.slice(0, MAX_HISTORY_TEXT) }, { role: 'assistant', text: assistantText(answer) }])
    }
  })
  const recent = pairs.slice(-MAX_HISTORY_ITEMS / 2)
  const bytes = () => new TextEncoder().encode(JSON.stringify(recent)).length
  while (recent.length && bytes() > MAX_HISTORY_BYTES) recent.shift()
  return recent.flat()
}
