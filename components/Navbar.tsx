import React, { useState, useEffect } from 'react';
import { User, Role } from '../types';
import { LogOut, Shield, LayoutGrid, AlertTriangle, PlusCircle } from 'lucide-react';
import { IncidentModal } from './IncidentModal';
import { io } from 'socket.io-client';

interface NavbarProps {
  user: User | null;
  onLogout: () => void;
  onNavigate: (view: 'DASHBOARD' | 'INCIDENTS') => void;
}

export const Navbar: React.FC<NavbarProps> = ({ user, onLogout, onNavigate }) => {
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
      <div className="sticky top-0 z-50 px-2 py-2 md:px-4 md:py-4 pointer-events-none">
        <nav className="max-w-7xl mx-auto pointer-events-auto">
           <div className="glass-dark rounded-xl md:rounded-2xl px-3 py-2.5 md:px-6 md:py-3 flex justify-between items-center shadow-2xl shadow-slate-900/10">
              
              {/* Logo Section */}
              <div
                className="flex items-center space-x-2 md:space-x-4 cursor-pointer"
                onClick={() => onNavigate('DASHBOARD')}
              >
                <div className="h-8 w-8 md:h-10 md:w-10 bg-white rounded-lg md:rounded-xl flex items-center justify-center shadow-md shrink-0">
                   <img src="/logo.png" alt="Logo" className="h-5 w-auto md:h-7 object-contain" />
                </div>
                <div>
                  <span className="block text-white font-bold text-sm md:text-base leading-none mb-0.5">La Hispanidad</span>
                  <span className="hidden sm:block text-slate-400 text-[10px] font-bold uppercase tracking-widest">Reserva de Espacios</span>
                </div>
              </div>

              {/* Actions Section */}
              {user && (
                <div className="flex items-center gap-2 md:gap-3 animate-fade-in">
                  
                  {/* Incidents Link (Admin Only) */}
                  {user.role === Role.ADMIN && (
                     <button
                       onClick={() => onNavigate('INCIDENTS')}
                       className="relative flex items-center gap-2 p-2 md:px-4 md:py-2 bg-slate-800/50 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg md:rounded-xl transition-all border border-slate-700 hover:border-slate-600 font-semibold text-xs md:text-sm"
                       title="Gestionar Incidencias"
                     >
                       <Shield className="h-4 w-4" />
                       <span className="hidden lg:inline">Incidencias</span>
                       {unresolvedCount > 0 && (
                         <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow-sm ring-1 ring-white">
                           {unresolvedCount}
                         </span>
                       )}
                     </button>
                  )}

                  {/* Link a Prisma (Solo icono en movil) */}
                  <a 
                    href="https://prisma.bibliohispa.es" 
                    className="flex items-center gap-2 p-2 md:px-4 md:py-2 bg-slate-800/50 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg md:rounded-xl transition-all border border-slate-700 hover:border-slate-600 font-semibold text-xs md:text-sm"
                    title="Ir al Portal Prisma"
                  >
                    <LayoutGrid className="h-4 w-4" />
                    <span className="hidden lg:inline">Prisma</span>
                  </a>

                  {/* User Badge - Muy compacto en Mobile */}
                  <div className="flex items-center bg-slate-800/50 border border-slate-700 rounded-full pl-1 pr-1 md:pr-4 py-1">
                     <div className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center ${user.role === Role.ADMIN ? 'bg-amber-500/20 text-amber-400' : 'bg-brand-500/20 text-brand-400'} ${!user.role ? 'mr-0' : 'md:mr-3'}`}>
                        {user.role === Role.ADMIN ? <Shield className="w-3.5 h-3.5 md:w-4 md:h-4" /> : <span className="font-bold text-xs">{user.name.charAt(0)}</span>}
                     </div>
                     <div className="hidden md:flex flex-col">
                        <span className="text-xs font-bold text-white leading-none mb-0.5">{user.name.split(' ')[0]}</span>
                        <span className="text-[9px] text-slate-400 leading-none uppercase font-bold">{user.role === Role.ADMIN ? 'Director' : 'Profesor'}</span>
                     </div>
                  </div>

                  <div className="h-6 w-px bg-slate-700 mx-1 hidden md:block"></div>

                  <button
                    onClick={onLogout}
                    className="flex items-center gap-2 p-2 md:px-4 md:py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg md:rounded-xl transition-all border border-transparent hover:border-red-500/30 font-semibold text-xs md:text-sm"
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