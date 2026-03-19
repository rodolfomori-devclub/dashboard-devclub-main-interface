// src/contexts/AuthContext.jsx
// Vault SDK integration — replaces Firebase Auth
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { VaultAuth } from '@vault-devclub/sdk';

const AuthContext = createContext();

// Vault configuration
const vault = new VaultAuth({
  vaultUrl: import.meta.env.VITE_VAULT_URL || 'http://localhost:4000',
  clientId: import.meta.env.VITE_VAULT_CLIENT_ID || '',
  redirectUri: import.meta.env.VITE_VAULT_REDIRECT_URI || `${window.location.origin}/callback`,
});

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRoles, setUserRoles] = useState(null);
  const [loading, setLoading] = useState(true);

  // Sync vault user to state
  const syncUser = useCallback((vaultUser) => {
    if (vaultUser) {
      setCurrentUser({
        uid: vaultUser.id,
        email: vaultUser.email,
        displayName: vaultUser.name,
      });

      // Map Vault roles to the format Dashboard expects
      // Vault stores: { "dashboard": ["today", "daily", "monthly"] }
      // Dashboard expects: { today: true, daily: true, isAdmin: false }
      const dashboardRoles = vaultUser.roles?.dashboard || {};
      const rolesObj = {};

      if (Array.isArray(dashboardRoles)) {
        dashboardRoles.forEach((r) => { rolesObj[r] = true; });
      } else {
        Object.assign(rolesObj, dashboardRoles);
      }

      rolesObj.isAdmin = vaultUser.role === 'SUPER_ADMIN' || vaultUser.role === 'ADMIN';

      setUserRoles(rolesObj);
    } else {
      setCurrentUser(null);
      setUserRoles(null);
    }
  }, []);

  // Initialize
  useEffect(() => {
    vault.onAuthChange(syncUser);

    async function init() {
      // Handle OAuth callback
      const params = new URLSearchParams(window.location.search);
      if (params.has('code')) {
        await vault.handleCallback();
      }

      // Load existing user
      const user = vault.getUser();
      if (user) {
        syncUser(user);
      } else if (localStorage.getItem('vault_refresh_token')) {
        const refreshed = await vault.refresh();
        if (refreshed) {
          syncUser(vault.getUser());
        }
      }

      setLoading(false);
    }

    init();
  }, [syncUser]);

  // Login — redirects to Vault
  const login = useCallback(() => {
    vault.login();
  }, []);

  // Logout
  const logout = useCallback(async () => {
    await vault.logout(true);
  }, []);

  // Check if user has permission to access a specific route
  const hasPermission = useCallback((route) => {
    if (!userRoles) return false;
    if (userRoles.isAdmin) return true;
    return userRoles[route] === true;
  }, [userRoles]);

  const value = {
    currentUser,
    userRoles,
    login,
    logout,
    hasPermission,
    loading,
    vault,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
