/* eslint-disable react/prop-types, react-refresh/only-export-components -- Shared authentication provider and hook. */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { vault, requestApi, refreshSession } from '../lib/api'
import { queryClient } from '../lib/queryClient'
const AuthContext = createContext(null)
export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [userRoles, setUserRoles] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const identityKey = useRef('')
  const clearPrivateData = useCallback(async () => {
    queryClient.clear()
    const { invalidateSalesCache } = await import('../components/daily/dailyData')
    invalidateSalesCache()
  }, [])
  const reload = useCallback(async () => {
    setError('')
    try {
      const { user } = await requestApi('/access')
      const nextKey = JSON.stringify([user.sub, user.isAdmin, [...user.permissions].sort()])
      if (identityKey.current !== nextKey) { await clearPrivateData(); identityKey.current = nextKey }
      setCurrentUser({ uid: user.sub, email: user.email, displayName: user.name })
      setUserRoles(Object.assign(Object.fromEntries([...user.permissions].sort().map(permission => [permission, true])), { isAdmin: user.isAdmin }))
    } catch (err) {
      identityKey.current = ''; await clearPrivateData()
      setCurrentUser(null); setUserRoles(null); setError(err.message)
    } finally { setLoading(false) }
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
        if (!vault.getAccessToken() && localStorage.getItem('vault_refresh_token')) await refreshSession()
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
  return <AuthContext.Provider value={{ currentUser, userRoles, loading, error, login, logout, hasPermission, vault, reload }}>{children}</AuthContext.Provider>
}
export const useAuth = () => useContext(AuthContext)
