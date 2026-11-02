import { useCallback, useEffect, useRef, useState } from 'react'
import { API_ERROR_MESSAGES, API_URL, apiFetch } from '../../lib/api'
import { buildHistory, endTurn, failTurn, failedRequest, newTurn, readNdjson, reduceAgentEvent, untilAborted } from './agentStream'

const STALL_MS = 45_000

/** The conversation lives only here: leaving the page or starting over discards it. */
export function useAgentChat() {
  const [messages, setMessages] = useState([])
  const [stalled, setStalled] = useState(false)
  const current = useRef(messages)
  const controller = useRef(null)
  const request = useRef(0)
  const commit = useCallback(next => { current.current = next; setMessages(next) }, [])

  const send = useCallback(async question => {
    const text = question.trim()
    if (!text || current.current.at(-1)?.status === 'streaming') return
    const id = ++request.current
    const abort = new AbortController()
    controller.current = abort
    const history = buildHistory(current.current)
    const turnId = `a${id}`
    commit([...current.current, { id: `u${id}`, role: 'user', text }, newTurn(turnId, text)])
    // Events of a request the user already left must not touch the new conversation.
    const patch = change => {
      if (request.current !== id) return
      const turn = current.current.find(message => message.id === turnId)
      const next = change(turn)
      if (next !== turn) commit(current.current.map(message => message === turn ? next : message))
    }
    let lastEvent = Date.now()
    setStalled(false)
    const watchdog = setInterval(() => setStalled(Date.now() - lastEvent >= STALL_MS), 5_000)
    try {
      const response = await untilAborted(apiFetch(`${API_URL}/agent/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text, history }), signal: abort.signal }), abort.signal)
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        patch(turn => failTurn(turn, failedRequest(response.status, data, API_ERROR_MESSAGES)))
        return
      }
      await readNdjson(response.body, event => {
        lastEvent = Date.now()
        setStalled(false)
        patch(turn => reduceAgentEvent(turn, event))
      })
      patch(turn => endTurn(turn, 'interrupted'))
    } catch {
      patch(turn => endTurn(turn, abort.signal.aborted ? 'cancelled' : 'interrupted'))
    } finally {
      clearInterval(watchdog)
      // A reading that gave up must not leave the server answering, and spending, for nobody.
      abort.abort()
      if (request.current === id) setStalled(false)
    }
  }, [commit])

  const stop = useCallback(() => controller.current?.abort(), [])
  const reset = useCallback(() => {
    request.current += 1
    controller.current?.abort()
    commit([])
  }, [commit])
  useEffect(() => () => { request.current += 1; controller.current?.abort() }, [])

  return { messages, stalled, send, stop, reset }
}
