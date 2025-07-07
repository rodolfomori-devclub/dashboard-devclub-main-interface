import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  FaUserCog,
  FaSignOutAlt,
  FaBars,
  FaTimes,
  FaChartPie,
  FaSun,
  FaMoon,
  FaHome,
  FaGlobe,
  FaCalendarAlt,
  FaCalendar,
  FaBriefcase,
  FaChartLine,
  FaRocket,
  FaDatabase,
  FaUser,
} from 'react-icons/fa'

export default function Header() {
  const location = useLocation()
  const { userRoles, logout, currentUser } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [darkMode, setDarkMode] = useState(false)

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme === 'dark') {
      setDarkMode(true)
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [])

  const toggleTheme = () => {
    const newDarkMode = !darkMode
    setDarkMode(newDarkMode)

    if (newDarkMode) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }

  const isActive = (path) => {
    return location.pathname === path
  }

  const handleLogout = () => {
    logout()
  }

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen)
  }

  const closeMobileMenu = () => {
    setMobileMenuOpen(false)
  }

  const menuItems = [
    { path: '/', label: 'Diário', icon: FaHome, condition: userRoles?.today !== false },
    { path: '/daily', label: 'Global', icon: FaGlobe, condition: userRoles?.daily !== false },
    { path: '/monthly', label: 'Mensal', icon: FaCalendarAlt, condition: userRoles?.monthly !== false },
    { path: '/yearly', label: 'Anual', icon: FaCalendar, condition: userRoles?.yearly !== false },
    { path: '/commercial', label: 'Comercial', icon: FaBriefcase, condition: userRoles?.commercial !== false },
    { path: '/comparativo', label: 'Comparativo', icon: FaChartLine, condition: userRoles?.commercial !== false },
    { path: '/launch', label: 'LaunchPro', icon: FaRocket, condition: userRoles?.dre !== false || userRoles?.isAdmin },
    { path: '/dre', label: 'DRE', icon: FaChartPie, condition: userRoles?.dre !== false || userRoles?.isAdmin },
    { path: '/data-sources', label: 'Fontes de Dados', icon: FaDatabase, condition: userRoles?.['data-sources'] !== false },
  ]

  return (
    <>
      {/* Glass Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-white/20 dark:border-gray-700/50 shadow-lg">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-blue-500/3 to-purple-500/5 dark:from-primary/10 dark:via-blue-500/5 dark:to-purple-500/10"></div>
        
        <nav className="relative container mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex justify-between items-center">
            {/* Logo/Brand */}
            <div className="flex items-center">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary to-primary-dark bg-clip-text text-transparent transition-all duration-300 hover:scale-105">
                DevClub
              </h1>
            </div>

            {/* Desktop Navigation - Responsivo */}
            <div className="hidden xl:flex items-center space-x-1 2xl:space-x-2">
              {menuItems.filter(item => item.condition).map((item) => {
                const Icon = item.icon
                const active = isActive(item.path)
                
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`
                      group relative px-3 2xl:px-4 py-2 2xl:py-2.5 rounded-xl transition-all duration-300 flex items-center space-x-1.5 2xl:space-x-2
                      ${active 
                        ? 'bg-gradient-to-r from-primary to-primary-dark text-white shadow-lg shadow-primary/25' 
                        : 'text-text-light dark:text-text-dark hover:bg-white/60 dark:hover:bg-gray-800/60 hover:shadow-md'
                      }
                    `}
                  >
                    <Icon className={`w-3.5 h-3.5 2xl:w-4 2xl:h-4 transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-110'}`} />
                    <span className="font-medium text-xs 2xl:text-sm whitespace-nowrap">{item.label}</span>
                    
                    {active && (
                      <div className="absolute inset-0 bg-gradient-to-r from-primary to-primary-dark rounded-xl opacity-20 animate-pulse"></div>
                    )}
                  </Link>
                )
              })}
            </div>

            {/* Desktop Right Side */}
            {currentUser && (
              <div className="hidden xl:flex items-center space-x-2 2xl:space-x-3">
                {/* Theme Toggle */}
                <button
                  onClick={toggleTheme}
                  className="group relative p-2.5 2xl:p-3 rounded-xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-lg border border-white/30 dark:border-gray-700/30 hover:bg-white/80 dark:hover:bg-gray-800/80 transition-all duration-300 hover:scale-105 hover:shadow-lg cursor-pointer"
                  aria-label={darkMode ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/20 to-orange-500/20 dark:from-blue-400/20 dark:to-purple-500/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  {darkMode ? (
                    <FaSun className="w-4 h-4 2xl:w-5 2xl:h-5 text-yellow-500 relative z-10 transition-transform duration-300 group-hover:rotate-12 cursor-pointer" />
                  ) : (
                    <FaMoon className="w-4 h-4 2xl:w-5 2xl:h-5 text-gray-600 relative z-10 transition-transform duration-300 group-hover:-rotate-12 cursor-pointer" />
                  )}
                </button>

                {/* Admin Link */}
                {userRoles?.isAdmin && (
                  <Link
                    to="/admin/users"
                    className={`
                      group relative px-3 2xl:px-4 py-2 2xl:py-2.5 rounded-xl transition-all duration-300 flex items-center space-x-1.5 2xl:space-x-2 cursor-pointer
                      ${isActive('/admin/users') 
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/25' 
                        : 'text-text-light dark:text-text-dark hover:bg-white/60 dark:hover:bg-gray-800/60 hover:shadow-md'
                      }
                    `}
                  >
                    <FaUserCog className="w-3.5 h-3.5 2xl:w-4 2xl:h-4 transition-transform duration-300 group-hover:rotate-12 cursor-pointer" />
                    <span className="font-medium text-xs 2xl:text-sm">Admin</span>
                  </Link>
                )}

                {/* User Info */}
                <div className="hidden 2xl:flex items-center space-x-2 px-3 py-2 rounded-xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-lg border border-white/30 dark:border-gray-700/30">
                  <div className="w-7 h-7 bg-gradient-to-r from-primary to-primary-dark rounded-full flex items-center justify-center shadow-lg">
                    <FaUser className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="text-xs font-medium text-text-light dark:text-text-dark whitespace-nowrap">
                    {currentUser?.email?.split('@')[0] || 'Usuário'}
                  </span>
                </div>

                {/* Logout Button */}
                <button
                  onClick={handleLogout}
                  className="group relative px-3 2xl:px-4 py-2 2xl:py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-600 hover:text-white transition-all duration-300 flex items-center space-x-1.5 2xl:space-x-2 hover:shadow-lg hover:shadow-red-500/25 hover:scale-105 cursor-pointer"
                >
                  <FaSignOutAlt className="w-3.5 h-3.5 2xl:w-4 2xl:h-4 transition-transform duration-300 group-hover:translate-x-1 cursor-pointer" />
                  <span className="font-medium text-xs 2xl:text-sm">Sair</span>
                </button>
              </div>
            )}

            {/* Mobile Menu Button - Aparece mais cedo */}
            <button
              className="xl:hidden p-2.5 sm:p-3 rounded-xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-lg border border-white/30 dark:border-gray-700/30 hover:bg-white/80 dark:hover:bg-gray-800/80 transition-all duration-300 hover:scale-105 cursor-pointer"
              onClick={toggleMobileMenu}
              aria-label="Toggle menu"
            >
              <div className="relative w-6 h-6">
                <FaBars className={`absolute inset-0 w-6 h-6 text-text-light dark:text-text-dark transition-all duration-300 ${mobileMenuOpen ? 'opacity-0 rotate-90' : 'opacity-100 rotate-0'}`} />
                <FaTimes className={`absolute inset-0 w-6 h-6 text-text-light dark:text-text-dark transition-all duration-300 ${mobileMenuOpen ? 'opacity-100 rotate-0' : 'opacity-0 -rotate-90'}`} />
              </div>
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile Menu Overlay */}
      <div className={`xl:hidden fixed inset-0 z-40 transition-all duration-300 ${mobileMenuOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
        <div 
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={closeMobileMenu}
        />
        
        {/* Mobile Menu Panel */}
        <div className={`absolute top-0 right-0 h-full w-80 max-w-[85vw] bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-l border-white/20 dark:border-gray-700/50 shadow-2xl transform transition-transform duration-300 ${mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="p-6">
            {/* Mobile Header */}
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary-dark bg-clip-text text-transparent">
                DevClub
              </h2>
              <button
                onClick={closeMobileMenu}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
              >
                <FaTimes className="w-5 h-5 text-text-light dark:text-text-dark cursor-pointer" />
              </button>
            </div>

            {/* Mobile Navigation */}
            <nav className="space-y-2">
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl hover:bg-white/60 dark:hover:bg-gray-800/60 transition-all duration-300 group"
              >
                {darkMode ? (
                  <FaSun className="w-5 h-5 text-yellow-500 transition-transform duration-300 group-hover:rotate-12" />
                ) : (
                  <FaMoon className="w-5 h-5 text-gray-600 transition-transform duration-300 group-hover:-rotate-12" />
                )}
                <span className="font-medium text-text-light dark:text-text-dark">
                  {darkMode ? 'Modo Claro' : 'Modo Escuro'}
                </span>
              </button>

              {/* Navigation Items */}
              {menuItems.filter(item => item.condition).map((item) => {
                const Icon = item.icon
                const active = isActive(item.path)
                
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={closeMobileMenu}
                    className={`
                      w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 group
                      ${active 
                        ? 'bg-gradient-to-r from-primary to-primary-dark text-white shadow-lg' 
                        : 'text-text-light dark:text-text-dark hover:bg-white/60 dark:hover:bg-gray-800/60'
                      }
                    `}
                  >
                    <Icon className={`w-5 h-5 transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-110'}`} />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                )
              })}

              {/* Admin Link */}
              {userRoles?.isAdmin && (
                <Link
                  to="/admin/users"
                  onClick={closeMobileMenu}
                  className={`
                    w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 group
                    ${isActive('/admin/users') 
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg' 
                      : 'text-text-light dark:text-text-dark hover:bg-white/60 dark:hover:bg-gray-800/60'
                    }
                  `}
                >
                  <FaUserCog className="w-5 h-5 transition-transform duration-300 group-hover:rotate-12" />
                  <span className="font-medium">Admin</span>
                </Link>
              )}

              {/* User Info */}
              {currentUser && (
                <div className="px-4 py-3 mt-6 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-10 h-10 bg-gradient-to-r from-primary to-primary-dark rounded-full flex items-center justify-center shadow-lg">
                      <FaUser className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-medium text-text-light dark:text-text-dark">
                        {currentUser?.email?.split('@')[0] || 'Usuário'}
                      </p>
                      <p className="text-sm text-text-muted-light dark:text-text-muted-dark">
                        {currentUser?.email}
                      </p>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => {
                      handleLogout()
                      closeMobileMenu()
                    }}
                    className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-600 hover:text-white transition-all duration-300 group"
                  >
                    <FaSignOutAlt className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
                    <span className="font-medium">Sair</span>
                  </button>
                </div>
              )}
            </nav>
          </div>
        </div>
      </div>

      {/* Spacer for fixed header */}
      <div className="h-16 sm:h-20"></div>
    </>
  )
}