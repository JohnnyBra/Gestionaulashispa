import React, { useState, useEffect } from 'react';
import { User, Role } from '../types';
import { LogOut, Shield, LayoutGrid, Sun, Moon, Monitor } from 'lucide-react';
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
      <div className="sticky top-0 z-50 pointer-events-none">
        <nav className="w-full pointer-events-auto border-b border-glass-border glass-header backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">

            {/* Logo Section */}
            <div
              className="flex items-center space-x-2.5 md:space-x-4 cursor-pointer group"
              onClick={() => onNavigate('DASHBOARD')}
            >
              <div className="h-9 w-9 md:h-11 md:w-11 bg-white rounded-xl md:rounded-2xl flex items-center justify-center shrink-0 shadow-md dark:shadow-lg dark:shadow-primary-500/10 ring-1 ring-black/5 dark:ring-white/10 group-hover:scale-105 transition-transform duration-200">
                <img src="/logo.png" alt="Logo" className="h-6 w-auto md:h-8 object-contain" />
              </div>
              <div>
                <span className="block text-gray-900 dark:text-white font-display font-bold text-sm md:text-base leading-none mb-0.5">La Hispanidad</span>
                <span className="hidden sm:block text-primary-500 dark:text-primary-400 text-[10px] font-bold uppercase tracking-widest">Reserva de Espacios</span>
              </div>
            </div>

            {/* Actions Section */}
            {user && (
              <div className="flex items-center gap-2 md:gap-3 animate-fade-in">

                {/* Theme Toggle */}
                <button
                  onClick={() => setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light')}
                  className="p-2 text-muted hover:bg-glass-bg rounded-lg transition-all duration-200 hover:scale-105 md:mr-2"
                  title={theme === 'dark' ? 'Modo oscuro' : theme === 'light' ? 'Modo claro' : 'Modo sistema'}
                >
                  {theme === 'dark' ? <Moon size={20} /> : theme === 'light' ? <Sun size={20} /> : <Monitor size={20} />}
                </button>

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

                {/* Link a Prisma (Solo icono en movil) */}
                <a
                  href="https://prisma.bibliohispa.es"
                  className="flex items-center gap-2 p-2 md:px-4 md:py-2 glass rounded-lg md:rounded-xl transition-all duration-200 font-semibold text-xs md:text-sm text-slate-700 dark:text-slate-300 hover:bg-glass-bg hover:scale-[1.02]"
                  title="Ir al Portal Prisma"
                >
                  <LayoutGrid className="h-4 w-4" />
                  <span className="hidden lg:inline">Prisma</span>
                </a>

                {/* User Badge - Muy compacto en Mobile */}
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
        </nav>
      </div>

      <IncidentModal
        isOpen={isIncidentModalOpen}
        onClose={() => setIsIncidentModalOpen(false)}
        user={user}
      />
    </>
  );
};