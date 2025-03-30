import React from 'react';
import { Link } from 'react-router-dom';
import { FaLock, FaHome, FaArrowLeft } from 'react-icons/fa';

function AccessDeniedPage() {
  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-red-100 dark:bg-red-900">
          <FaLock className="text-red-600 dark:text-red-400 text-3xl" />
        </div>
        
        <h1 className="text-2xl font-bold text-primary-dark dark:text-primary mb-2">
          Acesso Restrito
        </h1>
        
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Você não possui permissão para acessar esta página. 
          Entre em contato com um administrador para solicitar acesso.
        </p>
        
        <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 justify-center">
          <Link
            to="/"
            className="inline-flex items-center justify-center px-4 py-2 bg-primary hover:bg-primary-dark text-white dark:bg-primary-dark dark:hover:bg-primary rounded-lg transition-colors"
          >
            <FaHome className="mr-2" />
            Voltar ao Início
          </Link>
          
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            <FaArrowLeft className="mr-2" />
            Voltar
          </button>
        </div>
      </div>
    </div>
  );
}

export default AccessDeniedPage;