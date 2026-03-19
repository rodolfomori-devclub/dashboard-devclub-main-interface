// LoginPage is no longer needed — Vault handles login.
// This page only exists as a redirect fallback.
import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';

export default function LoginPage() {
  const { currentUser, login } = useAuth();

  useEffect(() => {
    if (!currentUser) {
      login(); // Redirects to Vault
    }
  }, [currentUser, login]);

  if (currentUser) {
    return <Navigate to="/diario" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-zinc-500">Redirecionando para login...</p>
      </div>
    </div>
  );
}
