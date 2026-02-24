import React, { useState, useEffect } from 'react';
import { User, Role } from '../types';
import { LogOut, Shield, Sun, Moon, Monitor } from 'lucide-react';
import { IncidentModal } from './IncidentModal';
import { io } from 'socket.io-client';
import { useTheme } from '../src/context/ThemeContext';

interface NavbarProps {
  user: User | null;
  onLogout: () => void;
  onNavigate: (view: 'DASHBOARD' | 'INCIDENTS') => void;
}

export const Navbar: React.FC<NavbarProps> = ({ user, onLogout, onNavigate }) => {
  const { theme, setTheme } = useTheme();
  const [isIncidentModalOpen, setIsIncidentModalOpen] = useState(false);
  const [unresolvedCount, setUnresolvedCount] = useState(0);

  useEffect(() => {
    if (user?.role !== Role.ADMIN) return;

    const fetchCount = async () => {
      try {
        const res = await fetch('http://localhost:3001/api/incidents');
        const data = await res.json();
        if (Array.isArray(data)) {
          setUnresolvedCount(data.filter((i: any) => !i.isResolved).length);
        }
      } catch (e) { console.error(e); }
    };
    fetchCount();

    const socket = io('http://localhost:3001');
    socket.on('server:incidents_updated', (data: any[]) => {
      setUnresolvedCount(data.filter(i => !i.isResolved).length);
    });

    return () => { socket.disconnect(); };
  }, [user]);

  return (
    <>
      <div className="glass-header sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">

          {/* Logo */}
          <div
            className="flex items-center gap-2 cursor-pointer group"
            onClick={() => onNavigate('DASHBOARD')}
          >
            <img
              src="/logo.png"
              alt="Logo La Hispanidad"
              className="h-10 w-auto object-contain dark:brightness-0 dark:invert group-hover:scale-105 transition-transform duration-200"
            />
          </div>

          {/* Actions */}
          {user && (
            <div className="flex items-center gap-2 md:gap-3">

              {/* Incidents Link (Admin Only) */}
              {user.role === Role.ADMIN && (
                <button
                  onClick={() => onNavigate('INCIDENTS')}
                  className="relative flex items-center gap-2 p-2 md:px-4 md:py-2 glass rounded-lg md:rounded-xl transition-all duration-200 font-semibold text-xs md:text-sm text-slate-700 dark:text-slate-300 hover:bg-glass-bg hover:scale-[1.02]"
                  title="Gestionar Incidencias"
                >
                  <Shield className="h-4 w-4" />
                  <span className="hidden lg:inline">Incidencias</span>
                  {unresolvedCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow-sm ring-1 ring-white dark:ring-slate-800">
                      <span className="absolute inset-0 rounded-full bg-red-500 animate-pulse-ring"></span>
                      {unresolvedCount}
                    </span>
                  )}
                </button>
              )}

              {/* User Badge */}
              <div className="flex items-center glass rounded-full pl-1 pr-1 md:pr-4 py-1">
                <div className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center ${user.role === Role.ADMIN ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400' : 'bg-primary-100 text-primary-600 dark:bg-brand-500/20 dark:text-brand-400'} ${!user.role ? 'mr-0' : 'md:mr-3'}`}>
                  {user.role === Role.ADMIN ? <Shield className="w-3.5 h-3.5 md:w-4 md:h-4" /> : <span className="font-bold text-xs">{user.name.charAt(0)}</span>}
                </div>
                <div className="hidden md:flex flex-col">
                  <span className="text-xs font-bold text-gray-900 dark:text-white leading-none mb-0.5">{user.name.split(' ')[0]}</span>
                  <span className="text-[9px] text-gray-500 dark:text-slate-400 leading-none uppercase font-bold">{user.role === Role.ADMIN ? 'Director' : 'Profesor'}</span>
                </div>
              </div>

              <div className="h-6 w-px bg-glass-border mx-1 hidden md:block"></div>

              {/* Theme Toggle (3 buttons) */}
              <div className="flex bg-gray-200 dark:bg-zinc-800 rounded-lg p-0.5">
                <button
                  onClick={() => setTheme('light')}
                  className={`flex justify-center p-1.5 rounded-md text-sm transition-colors ${theme === 'light' ? 'bg-white text-[#234B6E] shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                  title="Modo claro"
                >
                  <Sun size={14} />
                </button>
                <button
                  onClick={() => setTheme('system')}
                  className={`flex justify-center p-1.5 rounded-md text-sm transition-colors ${theme === 'system' ? 'bg-white dark:bg-zinc-700 text-[#234B6E] shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                  title="Automático"
                >
                  <Monitor size={14} />
                </button>
                <button
                  onClick={() => setTheme('dark')}
                  className={`flex justify-center p-1.5 rounded-md text-sm transition-colors ${theme === 'dark' ? 'bg-zinc-700 text-[#234B6E] shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                  title="Modo oscuro"
                >
                  <Moon size={14} />
                </button>
              </div>

              {/* Prisma Link */}
              <a
                href="https://prisma.bibliohispa.es"
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors font-medium"
                title="Ir al Portal Prisma"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="7" height="7" x="3" y="3" rx="1" />
                  <rect width="7" height="7" x="14" y="3" rx="1" fill="#3b82f6" stroke="#3b82f6" />
                  <rect width="7" height="7" x="14" y="14" rx="1" />
                  <rect width="7" height="7" x="3" y="14" rx="1" />
                </svg>
                <span className="hidden sm:inline">Prisma</span>
              </a>

              {/* Logout */}
              <button
                onClick={onLogout}
                className="flex items-center gap-2 p-2 md:px-4 md:py-2 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded-lg md:rounded-xl transition-all border border-red-500/10 hover:border-red-500/30 font-semibold text-xs md:text-sm"
                title="Cerrar sesión"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden md:inline">Salir</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <IncidentModal
        isOpen={isIncidentModalOpen}
        onClose={() => setIsIncidentModalOpen(false)}
        user={user}
      />
    </>
  );
};
