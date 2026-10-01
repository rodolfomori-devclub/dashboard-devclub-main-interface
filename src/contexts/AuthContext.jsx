/* eslint-disable react/prop-types, react-refresh/only-export-components -- Shared authentication provider and hook. */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { vault, requestApi, refreshSession, accessToken } from '../lib/api'
import { queryClient } from '../lib/queryClient'
const AuthContext = createContext(null)
export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [userRoles, setUserRoles] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [errorCode, setErrorCode] = useState('')
  const [errorStatus, setErrorStatus] = useState(null)
  const identityKey = useRef('')
  const accessRequest = useRef(0)
  const clearPrivateData = useCallback(async () => {
    queryClient.clear()
    const { invalidateSalesCache } = await import('../components/daily/dailyData')
    invalidateSalesCache()
  }, [])
  const reload = useCallback(async () => {
    const request = ++accessRequest.current
    setError(''); setErrorCode(''); setErrorStatus(null)
    try {
      // A fresh visit has no Dashboard session yet. Do not send anonymous API requests.
      const hadSession = !!vault.getAccessToken() || !!localStorage.getItem('vault_refresh_token') || !!identityKey.current
      if (!vault.getAccessToken() && localStorage.getItem('vault_refresh_token')) await refreshSession()
      if (!await accessToken()) {
        if (hadSession) throw Object.assign(new Error('Entre novamente pelo Vault para renovar sua sessão.'), { status: 401, code: 'VAULT_SESSION_INVALID' })
        if (request !== accessRequest.current) return
        identityKey.current = ''; await clearPrivateData()
        if (request !== accessRequest.current) return
        setCurrentUser(null); setUserRoles(null)
        return
      }
      const { user } = await requestApi('/access')
      if (request !== accessRequest.current) return
      const nextKey = JSON.stringify([user.sub, user.isAdmin, [...user.permissions].sort()])
      if (identityKey.current !== nextKey) { await clearPrivateData(); identityKey.current = nextKey }
      if (request !== accessRequest.current) return
      setCurrentUser({ uid: user.sub, email: user.email, displayName: user.name })
      setUserRoles(Object.assign(Object.fromEntries([...user.permissions].sort().map(permission => [permission, true])), { isAdmin: user.isAdmin }))
    } catch (err) {
      if (request !== accessRequest.current) return
      identityKey.current = ''; await clearPrivateData()
      if (request !== accessRequest.current) return
      setCurrentUser(null); setUserRoles(null); setError(err.message)
      setErrorCode(err.code || ''); setErrorStatus(err.status || null)
    } finally { if (request === accessRequest.current) setLoading(false) }
  }, [clearPrivateData])
  useEffect(() => {
    let active = true
    async function init() {
      try {
        if (vault.redirectToCanonicalOrigin()) return
        if (window.location.pathname === '/callback' && new URLSearchParams(location.search).has('code')) {
          if (!await vault.handleCallback()) throw new Error('Não foi possível concluir o login no Vault.')
          const destination = localStorage.getItem('vault_redirect_after') || '/'
          localStorage.removeItem('vault_redirect_after')
          const target = new URL(destination, window.location.origin)
          window.location.replace(target.origin === window.location.origin && target.pathname !== '/callback' ? `${target.pathname}${target.search}${target.hash}` : '/')
          return
        }
        if (active) await reload()
      } catch (err) { if (active) { setError(err.message); setLoading(false) } }
    }
    void init()
    const refreshAccess = () => { if (document.visibilityState === 'visible') void reload() }
    const timer = setInterval(refreshAccess, 120000)
    window.addEventListener('focus', refreshAccess)
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus', refreshAccess) }
  }, [reload])
  const login = useCallback(() => vault.login(), [])
  const logout = useCallback(async () => {
    await vault.logout(false)
    identityKey.current = ''; await clearPrivateData()
    setCurrentUser(null); setUserRoles(null)
    window.location.assign(import.meta.env.VITE_VAULT_HUB_URL || vault.vaultUrl)
  }, [clearPrivateData])
  const hasPermission = useCallback(permission => !!userRoles && (userRoles.isAdmin || userRoles[permission] === true), [userRoles])
  return <AuthContext.Provider value={{ currentUser, userRoles, loading, error, errorCode, errorStatus, login, logout, hasPermission, vault, reload }}>{children}</AuthContext.Provider>
}
export const useAuth = () => useContext(AuthContext)
