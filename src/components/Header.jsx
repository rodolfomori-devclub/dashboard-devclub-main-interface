import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { FaUserCog, FaSignOutAlt, FaBars, FaTimes } from 'react-icons/fa';

export default function Header() {
  const location = useLocation();
  const { userRoles, logout, currentUser } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path) => {
    return location.pathname === path ? 'bg-secondary text-primary' : '';
  };

  const handleLogout = () => {
    logout();
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  return (
    <header className="bg-primary text-secondary-dark dark:bg-gray-800 dark:text-primary sticky top-0 z-30 shadow-md">
      <nav className="container mx-auto px-4 py-4 flex justify-between items-center">
        {/* Logo/Brand */}
        <div className="flex items-center">
          <img 
            src="/devclub-logo.png" 
            alt="DevClub Logo" 
            className="h-8 w-8 mr-2 hidden dark:inline" 
          />
          <img 
            src="/devclub-logo-w.png" 
            alt="DevClub Logo" 
            className="h-8 w-8 mr-2 inline dark:hidden" 
          />
          <span className="font-bold text-lg hidden sm:inline">DevClub Dashboard</span>
        </div>

        {/* Mobile menu button */}
        <button 
          className="lg:hidden text-2xl"
          onClick={toggleMobileMenu}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <FaTimes /> : <FaBars />}
        </button>

        {/* Desktop menu */}
        <ul className="hidden lg:flex space-x-4 items-center">
          {userRoles?.today !== false && (
            <li>
              <Link
                to="/"
                className={`px-4 py-2 rounded hover:bg-secondary hover:text-primary transition-colors ${isActive('/')}`}
              >
                Diário
              </Link>
            </li>
          )}
          
          {userRoles?.daily !== false && (
            <li>
              <Link
                to="/daily"
                className={`px-4 py-2 rounded hover:bg-secondary hover:text-primary transition-colors ${isActive('/daily')}`}
              >
                Global
              </Link>
            </li>
          )}
          
          {userRoles?.monthly !== false && (
            <li>
              <Link
                to="/monthly"
                className={`px-4 py-2 rounded hover:bg-secondary hover:text-primary transition-colors ${isActive('/monthly')}`}
              >
                Consolidade Mensal
              </Link>
            </li>
          )}
          
          {userRoles?.yearly !== false && (
            <li>
              <Link
                to="/yearly"
                className={`px-4 py-2 rounded hover:bg-secondary hover:text-primary transition-colors ${isActive('/yearly')}`}
              >
                Consolidado Anual
              </Link>
            </li>
          )}
          
          {userRoles?.commercial !== false && (
            <li>
              <Link
                to="/commercial"
                className={`px-4 py-2 rounded hover:bg-secondary hover:text-primary transition-colors ${isActive('/commercial')}`}
              >
                Comercial
              </Link>
            </li>
          )}
          
          {userRoles?.['data-sources'] !== false && (
            <li>
              <Link
                to="/data-sources"
                className={`px-4 py-2 rounded hover:bg-secondary hover:text-primary transition-colors ${isActive('/data-sources')}`}
              >
                Fontes de Dados
              </Link>
            </li>
          )}
        </ul>
        
        {/* Desktop right side items */}
        {currentUser && (
          <div className="hidden lg:flex items-center space-x-4">
            {userRoles?.isAdmin && (
              <Link
                to="/admin/users"
                className={`flex items-center px-4 py-2 rounded hover:bg-secondary hover:text-primary transition-colors ${isActive('/admin/users')}`}
              >
                <FaUserCog className="mr-2" />
                Admin
              </Link>
            )}
            
            <button
              onClick={handleLogout}
              className="flex items-center px-4 py-2 rounded hover:bg-secondary hover:text-primary transition-colors"
            >
              <FaSignOutAlt className="mr-2" />
              Sair
            </button>
          </div>
        )}

        {/* Mobile menu overlay */}
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40" onClick={closeMobileMenu}>
            <div 
              className="bg-white dark:bg-gray-800 w-64 h-full p-5 transform transition-transform"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <span className="font-bold text-lg text-text-light dark:text-text-dark">Menu</span>
                <button onClick={closeMobileMenu} className="text-xl text-text-light dark:text-text-dark">
                  <FaTimes />
                </button>
              </div>

              <ul className="space-y-4">
                {userRoles?.today !== false && (
                  <li>
                    <Link
                      to="/"
                      className={`block px-4 py-2 rounded text-text-light dark:text-text-dark hover:bg-gray-100 dark:hover:bg-gray-700 ${isActive('/')}`}
                      onClick={closeMobileMenu}
                    >
                      Hoje
                    </Link>
                  </li>
                )}
                
                {userRoles?.daily !== false && (
                  <li>
                    <Link
                      to="/daily"
                      className={`block px-4 py-2 rounded text-text-light dark:text-text-dark hover:bg-gray-100 dark:hover:bg-gray-700 ${isActive('/daily')}`}
                      onClick={closeMobileMenu}
                    >
                      Dashboard
                    </Link>
                  </li>
                )}
                
                {userRoles?.monthly !== false && (
                  <li>
                    <Link
                      to="/monthly"
                      className={`block px-4 py-2 rounded text-text-light dark:text-text-dark hover:bg-gray-100 dark:hover:bg-gray-700 ${isActive('/monthly')}`}
                      onClick={closeMobileMenu}
                    >
                      Dados Mensais
                    </Link>
                  </li>
                )}
                
                {userRoles?.yearly !== false && (
                  <li>
                    <Link
                      to="/yearly"
                      className={`block px-4 py-2 rounded text-text-light dark:text-text-dark hover:bg-gray-100 dark:hover:bg-gray-700 ${isActive('/yearly')}`}
                      onClick={closeMobileMenu}
                    >
                      Dados Anuais
                    </Link>
                  </li>
                )}
                
                {userRoles?.commercial !== false && (
                  <li>
                    <Link
                      to="/commercial"
                      className={`block px-4 py-2 rounded text-text-light dark:text-text-dark hover:bg-gray-100 dark:hover:bg-gray-700 ${isActive('/commercial')}`}
                      onClick={closeMobileMenu}
                    >
                      Comercial
                    </Link>
                  </li>
                )}
                
                {userRoles?.['data-sources'] !== false && (
                  <li>
                    <Link
                      to="/data-sources"
                      className={`block px-4 py-2 rounded text-text-light dark:text-text-dark hover:bg-gray-100 dark:hover:bg-gray-700 ${isActive('/data-sources')}`}
                      onClick={closeMobileMenu}
                    >
                      Fontes de Dados
                    </Link>
                  </li>
                )}

                {userRoles?.isAdmin && (
                  <li>
                    <Link
                      to="/admin/users"
                      className={`block px-4 py-2 rounded text-text-light dark:text-text-dark hover:bg-gray-100 dark:hover:bg-gray-700 ${isActive('/admin/users')}`}
                      onClick={closeMobileMenu}
                    >
                      <FaUserCog className="inline mr-2" />
                      Admin
                    </Link>
                  </li>
                )}
                
                <li className="border-t pt-4 mt-4">
                  <button
                    onClick={() => {
                      handleLogout();
                      closeMobileMenu();
                    }}
                    className="block w-full text-left px-4 py-2 rounded text-text-light dark:text-text-dark hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <FaSignOutAlt className="inline mr-2" />
                    Sair
                  </button>
                </li>
              </ul>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}