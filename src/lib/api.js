import axios from 'axios'
import { VaultAuth } from './vault-sdk.js'
export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/$/, '')
export const vault = new VaultAuth({
  vaultUrl: import.meta.env.VITE_VAULT_URL || 'http://localhost:4000',
  clientId: import.meta.env.VITE_VAULT_CLIENT_ID || '',
  redirectUri: import.meta.env.VITE_VAULT_REDIRECT_URI || `${window.location.origin}/callback`,
})
let refreshPromise
export async function refreshSession() {
  if (!refreshPromise) refreshPromise = vault.refresh().then(refreshed => {
    // A failed renewal with retained credentials is an outage, not a refused
    // session. Do not send an expired token and turn that outage into a 401.
    if (!refreshed && localStorage.getItem('vault_refresh_token')) {
      throw Object.assign(new Error('O Vault está indisponível no momento. Tente novamente.'), { status: 503, code: 'VAULT_UNAVAILABLE' })
    }
    return refreshed
  }).finally(() => { refreshPromise = null })
  return refreshPromise
}
export async function accessToken() {
  let token = vault.getAccessToken()
  if (token) {
    let expiresSoon = false
    try {
      const encoded = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
      expiresSoon = JSON.parse(atob(encoded)).exp * 1000 < Date.now() + 30000
    } catch { /* Signature validation belongs to the API. */ }
    if (expiresSoon) {
      await refreshSession()
      token = vault.getAccessToken()
    }
  }
  return token
}
function isOwnApi(url) {
  const target = new URL(url, window.location.origin)
  const base = new URL(API_URL, window.location.origin)
  return target.origin === base.origin && (target.pathname === base.pathname || target.pathname.startsWith(`${base.pathname}/`))
}
axios.interceptors.request.use(async config => {
  if (isOwnApi(new URL(config.url, config.baseURL || window.location.origin).href)) {
    const token = await accessToken()
    if (token) config.headers.Authorization = `Bearer ${token}`
  }
  return config
})
axios.interceptors.response.use(response => response, async error => {
  const config = error.config
  if (config && isOwnApi(new URL(config.url, config.baseURL || window.location.origin).href) && error.response?.status === 401 && !config._vaultRetry) {
    config._vaultRetry = true
    if (await refreshSession()) return axios(config)
  }
  return Promise.reject(error)
})
export async function apiFetch(input, init = {}) {
  const url = typeof input === 'string' ? input : input.url
  if (!isOwnApi(url)) return fetch(input, init)
  const headers = new Headers(init.headers)
  const token = await accessToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  let response = await fetch(input, { ...init, headers })
  if (response.status === 401 && await refreshSession()) {
    headers.set('Authorization', `Bearer ${vault.getAccessToken()}`)
    response = await fetch(input, { ...init, headers })
  }
  return response
}
export async function requestApi(path, options = {}) {
  const response = await apiFetch(`${API_URL}${path}`, options)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const messages = {
      VAULT_MFA_REQUIRED: 'O acesso de administrador exige autenticação em duas etapas no Vault. Entre novamente após concluir a verificação.',
      DASHBOARD_ACCESS_REQUIRED: 'O login no Vault foi reconhecido, mas esta conta ainda precisa de um perfil e menus liberados no Dashboard.',
      VAULT_UNAVAILABLE: 'O Vault está indisponível no momento. Tente novamente.',
      VAULT_TOKEN_REQUIRED: 'Entre novamente para iniciar uma sessão no Dashboard.',
      VAULT_TOKEN_INVALID: 'Entre novamente pelo Vault para renovar sua sessão.',
      VAULT_SESSION_INVALID: 'Entre novamente pelo Vault para renovar sua sessão.',
    }
    throw Object.assign(new Error(messages[data.code] || data.error || data.message || `Não foi possível carregar os dados (${response.status}).`), { status: response.status, code: data.code })
  }
  return data
}
