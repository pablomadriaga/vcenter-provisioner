import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export interface NavItem {
  label: string;
  path: string;
  icon?: React.ReactNode;
}

export interface HeaderProps {
  showNav?: boolean;
  navItems?: NavItem[];
  onLogout?: () => void;
  userName?: string;
  title?: string;
}

const defaultNavItems: NavItem[] = [
  { label: 'Home', path: '/dashboard', icon: '🏠' },
  { label: 'Typifications', path: '/typifications', icon: '📝' },
  { label: 'VM Classes', path: '/vm-classes', icon: '🖥️' },
  { label: 'vCenter', path: '/vcenters', icon: '☁️' },
  { label: 'Stats', path: '/stats', icon: '📊' },
  { label: 'Monitor', path: '/monitor', icon: '👁️' },
];

export const Header: React.FC<HeaderProps> = ({
  showNav = true,
  navItems = defaultNavItems,
  onLogout,
  userName,
  title = 'vCenter Provisioner',
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    localStorage.removeItem('token');
    if (onLogout) {
      onLogout();
    } else {
      navigate('/login');
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-4">
            <h1
              className="text-xl font-bold text-gray-900 cursor-pointer"
              onClick={() => navigate('/dashboard')}
            >
              {title}
            </h1>
          </div>

          {showNav && (
            <nav className="hidden md:flex space-x-1">
              {navItems.map((item) => (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`
                    px-4 py-2 rounded-lg text-sm font-medium
                    transition-all duration-200
                    ${
                      location.pathname === item.path
                        ? 'bg-indigo-100 text-indigo-700 shadow-sm'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }
                  `}
                  data-testid={`nav-${item.label.toLowerCase()}`}
                >
                  {item.icon && <span className="mr-1.5">{item.icon}</span>}
                  {item.label}
                </button>
              ))}
            </nav>
          )}

          <div className="flex items-center space-x-3">
            {userName && (
              <span className="text-sm text-gray-500 hidden sm:block">
                {userName}
              </span>
            )}
            <button
              onClick={handleLogout}
              className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              data-testid="nav-logout"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {showNav && (
        <div className="md:hidden border-t border-gray-200">
          <div className="flex overflow-x-auto px-4 py-2 space-x-2">
            {navItems.map((item) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`
                  flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium
                  transition-all duration-200 whitespace-nowrap
                  ${
                    location.pathname === item.path
                      ? 'bg-indigo-100 text-indigo-700 shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100'
                  }
                `}
              >
                {item.icon && <span className="mr-1">{item.icon}</span>}
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
