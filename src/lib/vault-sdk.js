/**
 * Vault DevClub SDK
 *
 * SDK para integrar qualquer sistema React+Node ao Vault IAM.
 * Implementa OAuth2 Authorization Code + PKCE.
 */

function generateCodeVerifier() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

export class VaultAuth {
  constructor({ vaultUrl, clientId, redirectUri, scope = 'openid profile email roles' }) {
    this.vaultUrl = vaultUrl.replace(/\/$/, '');
    this.clientId = clientId;
    this.redirectUri = redirectUri;
    this.scope = scope;
    this._user = null;
    this._accessToken = null;
    this._refreshToken = null;
    this._onAuthChange = null;

    // Load from storage
    this._loadFromStorage();
  }

  // ---- Public API ----

  /** Redirect user to Vault login */
  async login() {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    sessionStorage.setItem('vault_code_verifier', codeVerifier);
    sessionStorage.setItem('vault_redirect_after', window.location.pathname);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: this.scope,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state: crypto.randomUUID(),
    });

    window.location.href = `${this.vaultUrl}/oauth/authorize?${params}`;
  }

  /** Handle callback after Vault login — exchange code for tokens */
  async handleCallback() {
    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    if (!code) return false;

    const codeVerifier = sessionStorage.getItem('vault_code_verifier');
    if (!codeVerifier) return false;

    try {
      const res = await fetch(`${this.vaultUrl}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          code,
          client_id: this.clientId,
          client_secret: '',  // PKCE flow, no secret needed for public clients
          redirect_uri: this.redirectUri,
          code_verifier: codeVerifier,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Token exchange failed');
      }

      const tokens = await res.json();
      this._setTokens(tokens);

      sessionStorage.removeItem('vault_code_verifier');

      // Clean URL
      const redirectAfter = sessionStorage.getItem('vault_redirect_after') || '/';
      sessionStorage.removeItem('vault_redirect_after');
      window.history.replaceState({}, '', redirectAfter);

      return true;
    } catch (err) {
      console.error('[Vault SDK] Callback error:', err);
      return false;
    }
  }

  /** Get current user from token */
  getUser() {
    if (!this._accessToken) return null;

    const payload = parseJwt(this._accessToken);
    if (!payload) return null;

    // Check expiry
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      this._clearTokens();
      return null;
    }

    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role,
      systems: payload.systems || [],
      roles: payload.roles || {},
    };
  }

  /** Get access token (for API calls) */
  getAccessToken() {
    return this._accessToken;
  }

  /** Check if user is authenticated */
  isAuthenticated() {
    return !!this.getUser();
  }

  /** Check if user has a specific role in a system */
  hasRole(roleName, systemSlug) {
    const user = this.getUser();
    if (!user) return false;
    if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return true;

    if (systemSlug) {
      return user.roles[systemSlug]?.includes(roleName) || false;
    }

    // Check across all systems
    return Object.values(user.roles).some((roles) => roles.includes(roleName));
  }

  /** Check if user has access to a system */
  hasSystemAccess(systemSlug) {
    const user = this.getUser();
    if (!user) return false;
    if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return true;
    return user.systems.includes(systemSlug);
  }

  /** Logout — redirect to Vault or clear locally */
  async logout(redirectToLogin = true) {
    if (this._refreshToken) {
      try {
        await fetch(`${this.vaultUrl}/oauth/revoke`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: this._refreshToken }),
        });
      } catch {
        // ignore
      }
    }

    this._clearTokens();

    if (redirectToLogin) {
      await this.login();
    }
  }

  /** Refresh access token */
  async refresh() {
    if (!this._refreshToken) return false;

    try {
      const res = await fetch(`${this.vaultUrl}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          refresh_token: this._refreshToken,
          client_id: this.clientId,
        }),
      });

      if (!res.ok) {
        this._clearTokens();
        return false;
      }

      const tokens = await res.json();
      this._setTokens(tokens);
      return true;
    } catch {
      this._clearTokens();
      return false;
    }
  }

  /** Register auth state change listener */
  onAuthChange(callback) {
    this._onAuthChange = callback;
  }

  // ---- Private ----

  _setTokens(tokens) {
    this._accessToken = tokens.access_token;
    this._refreshToken = tokens.refresh_token;
    this._user = this.getUser();

    localStorage.setItem('vault_access_token', tokens.access_token);
    if (tokens.refresh_token) {
      localStorage.setItem('vault_refresh_token', tokens.refresh_token);
    }
    if (tokens.id_token) {
      localStorage.setItem('vault_id_token', tokens.id_token);
    }

    this._onAuthChange?.(this._user);
  }

  _clearTokens() {
    this._accessToken = null;
    this._refreshToken = null;
    this._user = null;

    localStorage.removeItem('vault_access_token');
    localStorage.removeItem('vault_refresh_token');
    localStorage.removeItem('vault_id_token');

    this._onAuthChange?.(null);
  }

  _loadFromStorage() {
    this._accessToken = localStorage.getItem('vault_access_token');
    this._refreshToken = localStorage.getItem('vault_refresh_token');

    if (this._accessToken) {
      this._user = this.getUser();
      // If token expired, try refresh
      if (!this._user && this._refreshToken) {
        this.refresh();
      }
    }
  }
}
