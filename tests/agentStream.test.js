import test from 'node:test'
import assert from 'node:assert/strict'
import { announcement, buildHistory, canRetry, endTurn, failTurn, failedRequest, newTurn, progressText, readNdjson, reduceAgentEvent, untilAborted } from '../src/components/agent/agentStream.js'

const body = chunks => new ReadableStream({ start(controller) { for (const chunk of chunks) controller.enqueue(typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk); controller.close() } })
const read = async chunks => { const events = []; await readNdjson(body(chunks), event => events.push(event)); return events }
const play = (events, turn = newTurn('a1', 'pergunta')) => events.reduce(reduceAgentEvent, turn)
const doneTurn = (text = 'resposta', calls = []) => ({ ...newTurn('a', 'q'), status: 'done', calls, parts: text ? [{ type: 'text', text }] : [] })

test('a line split across chunks and a last line without newline are both read', async () => {
  assert.deepEqual(await read(['{"type":"te', 'xt","delta":"a"}\n{"type":"heartbeat"}\n\n', '{"type":"done"}']), [{ type: 'text', delta: 'a' }, { type: 'heartbeat' }, { type: 'done' }])
})

test('a character split across chunks arrives whole', async () => {
  const bytes = new TextEncoder().encode('{"type":"text","delta":"até"}\n')
  const cut = bytes.indexOf(0xc3) + 1
  assert.deepEqual(await read([bytes.slice(0, cut), bytes.slice(cut)]), [{ type: 'text', delta: 'até' }])
})

test('a line cut by the connection is an error, not a silent end', async () => {
  await assert.rejects(read(['{"type":"text","delta":"a"}\n{"type":"do']))
})

test('deltas merge, and parts keep the order they arrived in', () => {
  const block = { blockId: 'b1', kind: 'summary' }
  const turn = play([{ type: 'meta', model: 'x' }, { type: 'text', delta: 'Vou ' }, { type: 'text', delta: 'olhar.' }, { type: 'tool_start', callId: 'c1', label: 'Consultando' }, { type: 'status', callId: 'c1', text: 'Aguardando Guru' }])
  assert.equal(turn.activity, 'Aguardando Guru')
  assert.deepEqual(turn.calls, [{ id: 'c1', label: 'Consultando' }])
  const after = play([{ type: 'block', block }, { type: 'text', delta: 'Bloco 1.' }], turn)
  assert.equal(after.activity, '')
  assert.deepEqual(after.parts, [{ type: 'text', text: 'Vou olhar.' }, { type: 'block', block }, { type: 'text', text: 'Bloco 1.' }])
  assert.equal(after.parts[1].block, block, 'A block keeps its identity, so its charts do not redraw')
})

test('heartbeats and unknown events change nothing', () => {
  const turn = newTurn('a1', 'q')
  assert.equal(reduceAgentEvent(turn, { type: 'heartbeat' }), turn)
  assert.equal(reduceAgentEvent(turn, { type: 'from_the_future' }), turn)
  assert.equal(reduceAgentEvent(turn, null), turn)
})

test('done closes the turn with what the server flagged', () => {
  const turn = play([{ type: 'text', delta: 'x' }, { type: 'done', truncated: true, pending: true, unverifiedNumbers: ['R$ 999,99'] }])
  assert.equal(turn.status, 'done')
  assert.equal(turn.truncated, true)
  assert.equal(turn.pending, true)
  assert.deepEqual(turn.unverifiedNumbers, ['R$ 999,99'])
  assert.equal(reduceAgentEvent(turn, { type: 'text', delta: 'late' }), turn, 'Nothing changes a closed turn')
  assert.equal(endTurn(turn, 'interrupted'), turn, 'and the end of the stream does not reopen it')
})

test('a stream that ends without done is interrupted, keeping what arrived', () => {
  const block = { blockId: 'b1', kind: 'summary' }
  const turn = endTurn(play([{ type: 'block', block }]), 'interrupted')
  assert.equal(turn.status, 'interrupted')
  assert.match(turn.error.message, /conexão caiu/)
  assert.deepEqual(turn.parts, [{ type: 'block', block }])
  assert.equal(canRetry(turn), true)
  const cancelled = endTurn(newTurn('a', 'q'), 'cancelled')
  assert.match(cancelled.error.message, /Interrompido/)
  assert.equal(canRetry(cancelled), false)
})

test('an error event closes the turn and decides whether asking again helps', () => {
  const turn = play([{ type: 'error', code: 'AGENT_UPSTREAM_UNAVAILABLE', error: 'Ocupado.' }])
  assert.deepEqual([turn.status, turn.error.message, canRetry(turn)], ['error', 'Ocupado.', true])
  assert.deepEqual(turn.unverifiedNumbers, [])
  assert.deepEqual(play([{ type: 'error', code: 'X', error: 'x', unverifiedNumbers: ['R$ 999,99'] }]).unverifiedNumbers, ['R$ 999,99'], 'Text left on screen keeps its warning')
  for (const code of ['AGENT_REFUSED', 'AGENT_CONVERSATION_FULL', 'AGENT_BUDGET_EXCEEDED']) assert.equal(canRetry(play([{ type: 'error', code, error: 'x' }])), false, code)
  assert.equal(canRetry(failTurn(newTurn('a', 'q'), failedRequest(403))), false)
  assert.equal(canRetry(failTurn(newTurn('a', 'q'), failedRequest(503))), true)
})

test('HTTP failures read in Portuguese, using the server text only for the agent', () => {
  assert.match(failedRequest(401).message, /Entre novamente/)
  assert.match(failedRequest(403).message, /Administração/)
  assert.match(failedRequest(413).message, /longa demais/)
  assert.match(failedRequest(429).message, /Muitas perguntas/)
  assert.match(failedRequest(503).message, /indisponível/)
  assert.match(failedRequest(500).message, /\(500\)/)
  assert.equal(failedRequest(429, { code: 'AGENT_BUSY', error: 'Já há uma resposta em andamento.' }).message, 'Já há uma resposta em andamento.')
  assert.match(failedRequest(502, { code: 'OTHER', error: 'stack trace from a proxy' }).message, /\(502\)/)
  assert.equal(failedRequest(401, { code: 'VAULT_TOKEN_INVALID' }, { VAULT_TOKEN_INVALID: 'Renove.' }).message, 'Renove.')
  assert.match(failedRequest(503, null).message, /indisponível/)
})

test('history holds only finished turns, as text with the periods they consulted', () => {
  const messages = [
    { id: 'u1', role: 'user', text: 'primeira' }, doneTurn('Subiu.', [{ id: 'c1', label: 'Consultando 01/10/2026 a 31/10/2026' }, { id: 'c2', label: 'Conferindo as datas' }]),
    { id: 'u2', role: 'user', text: 'parada' }, endTurn(newTurn('a', 'parada'), 'cancelled'),
    { id: 'u3', role: 'user', text: 'falhou' }, failTurn(newTurn('a', 'falhou'), failedRequest(503)),
    { id: 'u4', role: 'user', text: 'sem texto' }, doneTurn('', [{ id: 'c3', label: 'Consultando 15/10/2026' }]),
    { id: 'u5', role: 'user', text: 'em andamento' }, newTurn('a', 'em andamento'),
  ]
  assert.deepEqual(buildHistory(messages), [
    { role: 'user', text: 'primeira' },
    { role: 'assistant', text: 'Subiu.\n\n[Consultas feitas: Consultando 01/10/2026 a 31/10/2026; Conferindo as datas]' },
    { role: 'user', text: 'sem texto' },
    { role: 'assistant', text: 'Resposta sem comentário em texto.\n\n[Consultas feitas: Consultando 15/10/2026]' },
  ])
  assert.deepEqual(buildHistory([]), [])
})

test('blocks never travel back to the server', () => {
  const turn = { ...doneTurn('Texto.'), parts: [{ type: 'text', text: 'Texto.' }, { type: 'block', block: { kind: 'summary', metrics: { revenue: { value: 999999 } } } }] }
  assert.equal(JSON.stringify(buildHistory([{ role: 'user', text: 'q' }, turn])).includes('999999'), false)
})

test('history stays inside what the API accepts', () => {
  const long = 'x'.repeat(5000)
  const accented = 'ã'.repeat(3900)
  const messages = Array.from({ length: 30 }, (_, index) => [{ role: 'user', text: `${index} ${accented}` }, doneTurn(long, [{ id: 'c', label: 'Consultando' }])]).flat()
  const history = buildHistory(messages)
  assert.ok(history.length <= 24)
  assert.equal(history[0].role, 'user', 'The API requires the first item to be the user')
  assert.ok(history.every(item => item.text.length <= 4000 && item.text.trim()))
  assert.match(history[1].text, /\[Consultas feitas: Consultando\]$/, 'A long answer still keeps the consulted periods')
  assert.ok(new TextEncoder().encode(JSON.stringify(history)).length <= 80_000)
  assert.equal(history.at(-2).text.startsWith('29 '), true, 'The newest turns are the ones kept')
})

test('a stalled answer is shown and announced, and status updates do not repeat announcements', () => {
  const turn = play([{ type: 'tool_start', callId: 'c1', label: 'Consultando outubro' }, { type: 'status', callId: 'c1', text: 'Aguardando Guru' }])
  assert.equal(progressText(turn, false), 'Aguardando Guru')
  assert.equal(announcement(turn, false), 'Consultando outubro', 'The status line changes every 2 s; the phase does not')
  assert.match(progressText(turn, true), /Sem resposta do servidor/)
  assert.match(announcement(turn, true), /Sem resposta do servidor/)
  assert.equal(progressText(newTurn('a', 'q'), false), 'Analisando a pergunta…')
  assert.equal(announcement(null, false), '')
  assert.equal(announcement(play([{ type: 'done' }]), false), 'Resposta pronta.')
  assert.equal(announcement(play([{ type: 'error', code: 'X', error: 'Falhou.' }]), false), 'Falhou.')
})

test('stopping ends the wait even when the session renewal behind it never answers', async () => {
  const controller = new AbortController()
  const waiting = untilAborted(new Promise(() => {}), controller.signal)
  controller.abort()
  await assert.rejects(waiting, error => error.name === 'AbortError')
  await assert.rejects(untilAborted(new Promise(() => {}), controller.signal), error => error.name === 'AbortError', 'Already stopped')
  assert.equal(await untilAborted(Promise.resolve('resposta'), new AbortController().signal), 'resposta')
  await assert.rejects(untilAborted(Promise.reject(new Error('rede')), new AbortController().signal), /rede/)
})
