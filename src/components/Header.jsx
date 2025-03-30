import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { FaUserCog, FaSignOutAlt, FaBars, FaTimes, FaChartPie, FaSun, FaMoon } from 'react-icons/fa';

export default function Header() {
  const location = useLocation();
  const { userRoles, logout, currentUser } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    // Check if user has a theme preference stored
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    } else {
      // Default to light theme
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, []);

  const toggleTheme = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    
    if (newDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

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
                Consolidado Mensal
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
          
          {(userRoles?.dre !== false || userRoles?.isAdmin) && (
            <li>
              <Link
                to="/dre"
                className={`px-4 py-2 rounded hover:bg-secondary hover:text-primary transition-colors ${isActive('/dre')}`}
              >
                DRE
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
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              aria-label={darkMode ? "Mudar para modo claro" : "Mudar para modo escuro"}
            >
              {darkMode ? (
                <FaSun className="text-xl text-yellow-400" />
              ) : (
                <FaMoon className="text-xl text-gray-700" />
              )}
            </button>

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
                {/* Theme Toggle in Mobile Menu */}
                <li>
                  <button
                    onClick={toggleTheme}
                    className="flex items-center w-full px-4 py-2 rounded text-text-light dark:text-text-dark hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    {darkMode ? (
                      <>
                        <FaSun className="mr-2 text-yellow-400" />
                        Modo Claro
                      </>
                    ) : (
                      <>
                        <FaMoon className="mr-2" />
                        Modo Escuro
                      </>
                    )}
                  </button>
                </li>

                {userRoles?.today !== false && (
                  <li>
                    <Link
                      to="/"
                      className={`block px-4 py-2 rounded text-primary dark:text-text-dark hover:bg-gray-100 dark:hover:bg-gray-700 ${isActive('/')}`}
                      onClick={closeMobileMenu}
                    >
                      Diário
                    </Link>
                  </li>
                )}
                
                {userRoles?.daily !== false && (
                  <li>
                    <Link
                      to="/daily"
                      className={`block px-4 py-2 rounded text-primary dark:text-text-dark hover:bg-gray-100 dark:hover:bg-gray-700 ${isActive('/daily')}`}
                      onClick={closeMobileMenu}
                    >
                      Global
                    </Link>
                  </li>
                )}
                
                {userRoles?.monthly !== false && (
                  <li>
                    <Link
                      to="/monthly"
                      className={`block px-4 py-2 rounded text-primary dark:text-text-dark hover:bg-gray-100 dark:hover:bg-gray-700 ${isActive('/monthly')}`}
                      onClick={closeMobileMenu}
                    >
                      Mensal
                    </Link>
                  </li>
                )}
                
                {userRoles?.yearly !== false && (
                  <li>
                    <Link
                      to="/yearly"
                      className={`block px-4 py-2 rounded text-primary dark:text-text-dark hover:bg-gray-100 dark:hover:bg-gray-700 ${isActive('/yearly')}`}
                      onClick={closeMobileMenu}
                    >
                      Anual
                    </Link>
                  </li>
                )}
                
                {userRoles?.commercial !== false && (
                  <li>
                    <Link
                      to="/commercial"
                      className={`block px-4 py-2 rounded text-primary dark:text-text-dark hover:bg-gray-100 dark:hover:bg-gray-700 ${isActive('/commercial')}`}
                      onClick={closeMobileMenu}
                    >
                      Comercial
                    </Link>
                  </li>
                )}
                
                {(userRoles?.dre !== false || userRoles?.isAdmin) && (
                  <li>
                    <Link
                      to="/dre"
                      className={`block px-4 py-2 rounded text-primary dark:text-text-dark hover:bg-gray-100 dark:hover:bg-gray-700 ${isActive('/dre')}`}
                      onClick={closeMobileMenu}
                    >
                      <FaChartPie className="inline mr-2" />
                      DRE
                    </Link>
                  </li>
                )}
                
                {userRoles?.['data-sources'] !== false && (
                  <li>
                    <Link
                      to="/data-sources"
                      className={`block px-4 py-2 rounded text-primary dark:text-text-dark hover:bg-gray-100 dark:hover:bg-gray-700 ${isActive('/data-sources')}`}
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
                      className={`block px-4 py-2 rounded text-primary dark:text-text-dark hover:bg-gray-100 dark:hover:bg-gray-700 ${isActive('/admin/users')}`}
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