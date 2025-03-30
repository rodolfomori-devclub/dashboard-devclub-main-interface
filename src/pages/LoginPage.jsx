// src/pages/LoginPage.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { FaSignInAlt, FaSpinner } from 'react-icons/fa';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  const { login, currentUser } = useAuth();
  
  useEffect(() => {
    // Check for stored theme preference
    const savedTheme = localStorage.getItem('theme');
    setIsDarkMode(savedTheme === 'dark');
  }, []);
  
  // If user is already logged in, redirect to dashboard
  if (currentUser) {
    return <Navigate to="/" />;
  }
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError('Por favor, preencha email e senha');
      return;
    }
    
    try {
      setError('');
      setIsLoading(true);
      await login(email, password);
      // Redirect will happen automatically due to the Navigate component above
    } catch (error) {
      console.error('Login error:', error);
      let errorMessage = 'Falha na autenticação';
      
      // Extract more specific error messages from Firebase
      if (error.code === 'auth/invalid-credential') {
        errorMessage = 'Email ou senha inválidos';
      } else if (error.code === 'auth/user-not-found') {
        errorMessage = 'Usuário não encontrado';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Senha incorreta';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Muitas tentativas. Tente novamente mais tarde';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background-light dark:bg-background-dark p-4 sm:p-6">
      <div className="w-full max-w-md space-y-8 bg-white dark:bg-gray-800 p-6 sm:p-10 rounded-lg shadow-xl">
        <div className="text-center">
          <img 
            src={isDarkMode ? "/devclub-logo-w.png" : "/devclub-logo.png"}
            alt="DevClub Logo" 
            className="mx-auto h-20 w-20"
          />
          <h2 className="mt-6 text-3xl font-bold text-primary dark:text-secondary">
            Dashboard Login
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            Entre com suas credenciais para acessar
          </p>
        </div>
        
        {error && (
          <div className="bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded relative" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md -space-y-px">
            <div className="mb-4">
              <label htmlFor="email-address" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="appearance-none relative block w-full px-3 py-3 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-primary focus:border-primary dark:focus:ring-secondary dark:focus:border-secondary focus:z-10 text-sm sm:text-base"
                placeholder="Email"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Senha
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="appearance-none relative block w-full px-3 py-3 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-primary focus:border-primary dark:focus:ring-secondary dark:focus:border-secondary focus:z-10 text-sm sm:text-base"
                placeholder="Senha"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm sm:text-base font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary dark:bg-secondary dark:text-primary-dark dark:hover:bg-secondary-light dark:focus:ring-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {isLoading ? (
                <FaSpinner className="animate-spin h-5 w-5 mr-2" />
              ) : (
                <FaSignInAlt className="h-5 w-5 mr-2" />
              )}
              {isLoading ? 'Entrando...' : 'Entrar'}
            </button>
          </div>
        </form>
      </div>
      
      <p className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
        Dashboard Administrativo DevClub &copy; {new Date().getFullYear()}
      </p>
    </div>
  );
};

export default LoginPage;