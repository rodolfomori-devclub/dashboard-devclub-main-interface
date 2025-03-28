import { Link, useLocation } from 'react-router-dom';

export default function Header() {
  const location = useLocation();

  const isActive = (path) => {
    return location.pathname === path ? 'bg-secondary text-primary' : '';
  };

  return (
    <header className="bg-primary text-secondary-dark dark:bg-gray-800 dark:text-primary">
      <nav className="container mx-auto px-6 py-4">
        <ul className="flex space-x-4 flex-wrap">
          <li>
            <Link
              to="/"
              className={`px-4 py-2 rounded hover:bg-secondary hover:text-primary transition-colors ${isActive('/')}`}
            >
              Hoje
            </Link>
          </li>
          <li>
            <Link
              to="/daily"
              className={`px-4 py-2 rounded hover:bg-secondary hover:text-primary transition-colors ${isActive('/daily')}`}
            >
              Dashboard
            </Link>
          </li>
          <li>
            <Link
              to="/monthly"
              className={`px-4 py-2 rounded hover:bg-secondary hover:text-primary transition-colors ${isActive('/monthly')}`}
            >
              Dados Mensais
            </Link>
          </li>
          <li>
            <Link
              to="/yearly"
              className={`px-4 py-2 rounded hover:bg-secondary hover:text-primary transition-colors ${isActive('/yearly')}`}
            >
              Dados Anuais
            </Link>
          </li>
          <li>
            <Link
              to="/commercial"
              className={`px-4 py-2 rounded hover:bg-secondary hover:text-primary transition-colors ${isActive('/commercial')}`}
            >
              Comercial
            </Link>
          </li>
          <li>
            <Link
              to="/data-sources"
              className={`px-4 py-2 rounded hover:bg-secondary hover:text-primary transition-colors ${isActive('/data-sources')}`}
            >
              Fontes de Dados
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}