import React from 'react';
import { User, Role } from '../types';
import { LogOut, Shield } from 'lucide-react';

interface NavbarProps {
  user: User | null;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ user, onLogout }) => {
  return (
    <>
      <div className="sticky top-0 z-50 px-3 py-3 md:px-4 md:py-4 pointer-events-none">
        <nav className="max-w-7xl mx-auto pointer-events-auto">
           <div className="glass-dark rounded-xl md:rounded-2xl px-4 py-3 md:px-6 md:py-3 flex justify-between items-center shadow-2xl shadow-slate-900/10">
              
              {/* Logo Section */}
              <div className="flex items-center space-x-3 md:space-x-4 cursor-pointer">
                <div className="h-8 w-8 md:h-10 md:w-10 bg-white rounded-lg md:rounded-xl flex items-center justify-center shadow-md shrink-0">
                   <img src="/logo.png" alt="Logo" className="h-5 w-auto md:h-7 object-contain" />
                </div>
                <div>
                  {/* Title visible on all screens, resized for mobile */}
                  <span className="block text-white font-bold text-sm md:text-base leading-none mb-0.5">La Hispanidad</span>
                  {/* Subtitle hidden on very small screens to save space */}
                  <span className="hidden sm:block text-slate-400 text-[10px] font-bold uppercase tracking-widest">Reserva de Espacios</span>
                </div>
              </div>

              {/* Actions Section */}
              {user && (
                <div className="flex items-center gap-2 md:gap-3 animate-fade-in">
                  
                  {/* User Badge - Compact on Mobile */}
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
                    className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg md:rounded-xl transition-all border border-transparent hover:border-red-500/30 font-semibold text-xs md:text-sm"
                    title="Cerrar sesión"
                  >
                    <LogOut className="h-4 w-4" />
                    <span className="hidden sm:inline">Salir</span>
                  </button>
                </div>
              )}
           </div>
        </nav>
      </div>
    </>
  );
};