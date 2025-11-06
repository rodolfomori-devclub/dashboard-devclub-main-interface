import { useNavigate } from 'react-router-dom';
import { FaLock, FaArrowLeft } from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';

function AccessDeniedPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  // Handle back button click - logout and go to login
  const handleBackToLogin = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
      // Even if logout fails, navigate to login
      navigate('/login', { replace: true });
    }
  };

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

        <div className="flex justify-center">
          <button
            onClick={handleBackToLogin}
            className="inline-flex items-center justify-center px-6 py-3 bg-primary hover:bg-primary-dark text-white dark:bg-primary-dark dark:hover:bg-primary rounded-lg transition-colors"
          >
            <FaArrowLeft className="mr-2" />
            Fazer Login Novamente
          </button>
        </div>
      </div>
    </div>
  );
}

export default AccessDeniedPage;