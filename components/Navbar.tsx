import React, { useState } from 'react';
import { User, Role } from '../types';
import { LogOut, Shield, Key, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Modal } from './Modal';

interface NavbarProps {
  user: User | null;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ user, onLogout }) => {
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [msg, setMsg] = useState<{ type: 'error' | 'success', text: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      });

      if (!response.ok) throw new Error('API Error');

      const data = await response.json();

      if (data.success) {
        setMsg({ type: 'success', text: 'Contraseña actualizada.' });
        setCurrentPassword('');
        setNewPassword('');
        setTimeout(() => setIsPasswordModalOpen(false), 2000);
      } else {
        setMsg({ type: 'error', text: data.message || 'Error.' });
      }
    } catch (error) {
      setMsg({ type: 'error', text: 'Error de conexión.' });
    } finally {
      setIsLoading(false);
    }
  };

  const closeModal = () => {
    setIsPasswordModalOpen(false);
    setMsg(null);
    setCurrentPassword('');
    setNewPassword('');
  };

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

                  {user.role === Role.ADMIN && (
                     <button
                      onClick={() => setIsPasswordModalOpen(true)}
                      className="p-2 md:p-2.5 rounded-lg md:rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                      title="Cambiar contraseña"
                     >
                       <Key className="h-4 w-4 md:h-5 md:w-5" />
                     </button>
                  )}

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

      <Modal isOpen={isPasswordModalOpen} onClose={closeModal} title="Seguridad de la Cuenta">
         <form onSubmit={handleChangePassword} className="space-y-5">
             {msg && (
               <div className={`p-4 rounded-xl flex items-start gap-3 text-sm font-medium ${msg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                 {msg.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                 {msg.text}
               </div>
             )}

             <div>
               <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Contraseña Actual</label>
               <input
                 type="password"
                 required
                 value={currentPassword}
                 onChange={(e) => setCurrentPassword(e.target.value)}
                 className="block w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all outline-none font-medium"
                 placeholder="••••••••"
               />
             </div>
             
             <div>
               <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nueva Contraseña</label>
               <input
                 type="password"
                 required
                 minLength={4}
                 value={newPassword}
                 onChange={(e) => setNewPassword(e.target.value)}
                 className="block w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all outline-none font-medium"
                 placeholder="••••••••"
               />
             </div>

             <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
               <button
                 type="button"
                 onClick={closeModal}
                 className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors"
               >
                 Cancelar
               </button>
               <button
                 type="submit"
                 disabled={isLoading}
                 className="flex items-center px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 disabled:opacity-70 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all"
               >
                 {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                 Actualizar Clave
               </button>
             </div>
         </form>
      </Modal>
    </>
  );
};