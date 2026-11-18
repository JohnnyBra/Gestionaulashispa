import React, { useState, useEffect } from 'react';
import { User, Role } from '../types';
import { LogOut, Shield, Sun, Moon, Monitor, AlertTriangle } from 'lucide-react';
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
        const res = await fetch('/api/incidents');
        const data = await res.json();
        if (Array.isArray(data)) {
          setUnresolvedCount(data.filter((i: any) => !i.isResolved).length);
        }
      } catch (e) { console.error(e); }
    };
    fetchCount();

    const socket = io();
    socket.on('server:incidents_updated', (data: any[]) => {
      setUnresolvedCount(data.filter(i => !i.isResolved).length);
    });

    return () => { socket.disconnect(); };
  }, [user]);

  return (
    <>
      {/* Cabecera común de la Suite La Hispanidad (kit servido desde Prisma) */}
      <header className="hs-header gap-2 !px-3 sm:!px-4">
          <a
            className="hs-marca min-w-0"
            href="/"
            onClick={(e) => { e.preventDefault(); onNavigate('DASHBOARD'); }}
          >
            <img className="hs-escudo" src="https://prisma.bibliohispa.es/suite/escudo.png" alt="Colegio La Hispanidad" />
            <span className="min-w-0 overflow-hidden">
              <span className="hs-marca-nombre">Reservas Aulas</span>
              <span className="hs-firma truncate">Creado por Javi Barrero</span>
            </span>
          </a>

          {/* Actions */}
          {user && (
            <div className="flex items-center gap-1.5 md:gap-3 ml-auto shrink-0">

              {/* Incidents Link (Admin Only) */}
              {user.role === Role.ADMIN && (
                <button
                  onClick={() => onNavigate('INCIDENTS')}
                  className="relative flex items-center gap-2 p-2 md:px-4 md:py-2 glass rounded-lg md:rounded-xl transition-all duration-200 font-semibold text-xs md:text-sm text-slate-700 dark:text-slate-300 hover:bg-glass-bg hover:scale-[1.02]"
                  title="Gestionar Incidencias" aria-label="Gestionar incidencias"
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

              {/* Report Pizarra Button */}
              <button
                onClick={() => setIsIncidentModalOpen(true)}
                className="flex items-center gap-1.5 p-2 md:px-3 md:py-2 glass hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-600 hover:text-red-600 dark:text-slate-300 dark:hover:text-red-400 rounded-lg md:rounded-xl transition-all border border-transparent hover:border-red-200 dark:hover:border-red-800 font-semibold text-xs md:text-sm"
                title="Reportar Pizarra Digital" aria-label="Reportar pizarra digital"
              >
                <AlertTriangle className="h-4 w-4" />
                <span className="hidden xl:inline">Reportar Pizarra</span>
              </button>

              {/* User Badge */}
              <div className="hidden md:flex items-center glass rounded-full pl-1 pr-1 md:pr-4 py-1">
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
              {/* En móvil, un solo botón que va cambiando de tema */}
              <button
                onClick={() => setTheme(theme === 'light' ? 'system' : theme === 'system' ? 'dark' : 'light')}
                className="sm:hidden p-2 glass rounded-lg text-slate-600 dark:text-slate-300"
                aria-label={`Tema: ${theme === 'light' ? 'claro' : theme === 'system' ? 'automático' : 'oscuro'}. Cambiar`}
                title="Cambiar tema"
              >
                {theme === 'light' ? <Sun className="h-4 w-4" /> : theme === 'system' ? <Monitor className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <div className="hidden sm:flex bg-gray-200 dark:bg-zinc-800 rounded-lg p-0.5">
                <button
                  onClick={() => setTheme('light')}
                  className={`flex justify-center p-1.5 rounded-md text-sm transition-colors ${theme === 'light' ? 'bg-white text-[#0a4a8c] dark:text-sky-300 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                  title="Modo claro" aria-label="Modo claro"
                >
                  <Sun size={14} />
                </button>
                <button
                  onClick={() => setTheme('system')}
                  className={`flex justify-center p-1.5 rounded-md text-sm transition-colors ${theme === 'system' ? 'bg-white dark:bg-zinc-700 text-[#0a4a8c] dark:text-sky-300 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                  title="Automático" aria-label="Automático"
                >
                  <Monitor size={14} />
                </button>
                <button
                  onClick={() => setTheme('dark')}
                  className={`flex justify-center p-1.5 rounded-md text-sm transition-colors ${theme === 'dark' ? 'bg-zinc-700 text-[#0a4a8c] dark:text-sky-300 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                  title="Modo oscuro" aria-label="Modo oscuro"
                >
                  <Moon size={14} />
                </button>
              </div>

              {/* Prisma Link */}
              <a
                href="https://prisma.bibliohispa.es"
                aria-label="Ir al Portal Prisma"
                className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors font-medium"
                title="Ir al Portal Prisma"
              >
                <span className="hs-prisma" style={{ '--t': '18px' } as React.CSSProperties} aria-hidden="true" />
                <span className="hidden sm:inline">Prisma</span>
              </a>

              {/* Logout */}
              <button
                onClick={onLogout}
                className="flex items-center gap-2 p-2 md:px-4 md:py-2 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded-lg md:rounded-xl transition-all border border-red-500/10 hover:border-red-500/30 font-semibold text-xs md:text-sm"
                title="Cerrar sesión" aria-label="Cerrar sesión"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden md:inline">Salir</span>
              </button>
            </div>
          )}
      </header>

      <IncidentModal
        isOpen={isIncidentModalOpen}
        onClose={() => setIsIncidentModalOpen(false)}
        user={user!}
        fixedResource="PIZARRA"
      />
    </>
  );
};
