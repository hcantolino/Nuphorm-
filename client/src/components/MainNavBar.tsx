import React, { useCallback, useMemo } from 'react';
import { Home, Upload, FolderOpen, User, Zap, Settings, LogOut } from 'lucide-react';
import { useLocation } from 'wouter';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
  badge?: number;
}

interface MainNavBarProps {
  onLogout?: () => void;
  userName?: string;
}

/**
 * Main vertical navigation bar (60px width)
 * Pharma-themed with subtle molecule icons and blue accent
 */
export default function MainNavBar({ onLogout, userName = 'User' }: MainNavBarProps) {
  const [location] = useLocation();

  const navigate = useCallback((path: string) => {
    window.location.href = path;
  }, []);

  const navItems: NavItem[] = useMemo(
    () => [
      {
        id: 'home',
        label: 'Home',
        icon: <Home className="w-5 h-5" />,
        path: '/',
      },
      {
        id: 'uploads',
        label: 'Repository',
        icon: <Upload className="w-5 h-5" />,
        path: '/uploads',
        badge: 2,
      },
      {
        id: 'projects',
        label: 'Projects',
        icon: <FolderOpen className="w-5 h-5" />,
        path: '/projects',
        badge: 1,
      },
      {
        id: 'creator',
        label: 'Creator',
        icon: <Zap className="w-5 h-5" />,
        path: '/creator',
      },
    ],
    []
  );

  const isActive = useCallback((path: string) => {
    return location === path;
  }, [location]);

  const handleNavClick = useCallback(
    (path: string) => {
      navigate(path);
    },
    []
  );

  return (
    <nav className="fixed left-0 top-0 bottom-0 w-16 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 border-r border-slate-700 flex flex-col items-center py-4 z-50 shadow-lg">
      {/* Logo / Branding */}
      <div className="mb-8 flex items-center justify-center w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 shadow-lg">
        <Zap className="w-6 h-6 text-white" />
      </div>

      {/* Navigation Items */}
      <div className="flex-1 flex flex-col gap-4">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => handleNavClick(item.path)}
            className={`relative w-12 h-12 rounded-lg flex items-center justify-center transition-all duration-200 group ${
              isActive(item.path)
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/50'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
            title={item.label}
            aria-label={item.label}
          >
            {item.icon}

            {/* Badge */}
            {item.badge && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {item.badge}
              </span>
            )}

            {/* Tooltip */}
            <div className="absolute left-full ml-2 px-2 py-1 bg-slate-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              {item.label}
            </div>
          </button>
        ))}
      </div>

      {/* Bottom Actions */}
      <div className="flex flex-col gap-3 pt-4 border-t border-slate-700">
        {/* Settings */}
        <button
          className="w-12 h-12 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-all duration-200 group"
          title="Settings"
          aria-label="Settings"
        >
          <Settings className="w-5 h-5" />
          <div className="absolute left-full ml-2 px-2 py-1 bg-slate-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            Settings
          </div>
        </button>

        {/* Account */}
        <button
          className="w-12 h-12 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-all duration-200 group"
          title={`Account (${userName})`}
          aria-label="Account"
        >
          <User className="w-5 h-5" />
          <div className="absolute left-full ml-2 px-2 py-1 bg-slate-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            {userName}
          </div>
        </button>

        {/* Logout */}
        <button
          onClick={onLogout}
          className="w-12 h-12 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-red-900/20 transition-all duration-200 group"
          title="Logout"
          aria-label="Logout"
        >
          <LogOut className="w-5 h-5" />
          <div className="absolute left-full ml-2 px-2 py-1 bg-slate-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            Logout
          </div>
        </button>
      </div>

      {/* Pharma Accent Element */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600" />
    </nav>
  );
}
