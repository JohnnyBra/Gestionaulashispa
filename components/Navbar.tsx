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
        setMsg({ type: 'success', text: 'Contraseña actualizada correctamente.' });
        setCurrentPassword('');
        setNewPassword('');
        setTimeout(() => setIsPasswordModalOpen(false), 2000);
      } else {
        setMsg({ type: 'error', text: data.message || 'Error al actualizar.' });
      }
    } catch (error) {
      console.warn("API Error, fallback local");
      // Fallback LOCAL
      const localAdminPass = localStorage.getItem('hispanidad_admin_pass') || 'adminhispanidad';
      
      if (currentPassword === localAdminPass) {
          localStorage.setItem('hispanidad_admin_pass', newPassword);
          setMsg({ type: 'success', text: 'Contraseña actualizada (Modo Local).' });
          setCurrentPassword('');
          setNewPassword('');
          setTimeout(() => setIsPasswordModalOpen(false), 2000);
      } else {
          setMsg({ type: 'error', text: 'Contraseña actual incorrecta (Modo Local).' });
      }
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
      <nav className="glass-dark text-white shadow-lg sticky top-0 z-50 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center space-x-3 group cursor-pointer">
              <div className="h-10 w-10 bg-white rounded-lg p-1 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform duration-200 overflow-hidden">
                <img src="/logo.png" alt="Logo La Hispanidad" className="h-full w-full object-contain" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-lg leading-tight tracking-tight">La Hispanidad</span>
                <span className="text-[10px] text-primary-200 uppercase tracking-widest font-semibold">Gestión de Aulas</span>
              </div>
            </div>
            
            {user && (
              <div className="flex items-center space-x-4 animate-fade-in">
                <div className="hidden md:flex flex-col items-end">
                  <span className="text-sm font-semibold">{user.name}</span>
                  <div className="flex items-center text-xs text-primary-200 bg-primary-800/50 px-2 py-0.5 rounded-full">
                     {user.role === Role.ADMIN && <Shield className="w-3 h-3 mr-1 text-yellow-400" />}
                     {user.email}
                  </div>
                </div>
                
                {user.role === Role.ADMIN && (
                   <button
                    onClick={() => setIsPasswordModalOpen(true)}
                    className="p-2 rounded-full hover:bg-white/10 transition-colors text-primary-100 hover:text-white border border-transparent hover:border-white/20"
                    title="Cambiar contraseña"
                   >
                     <Key className="h-5 w-5" />
                   </button>
                )}

                <button
                  onClick={onLogout}
                  className="p-2 rounded-full hover:bg-white/10 transition-colors text-primary-100 hover:text-white border border-transparent hover:border-white/20"
                  title="Cerrar sesión"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Admin Password Change Modal */}
      <Modal isOpen={isPasswordModalOpen} onClose={closeModal} title="Cambiar Contraseña">
         <form onSubmit={handleChangePassword} className="space-y-4">
             {msg && (
               <div className={`p-3 rounded-lg flex items-center text-sm ${msg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                 {msg.type === 'success' ? <CheckCircle2 className="w-4 h-4 mr-2" /> : <AlertCircle className="w-4 h-4 mr-2" />}
                 {msg.text}
               </div>
             )}

             <div>
               <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Contraseña Actual</label>
               <input
                 type="password"
                 required
                 value={currentPassword}
                 onChange={(e) => setCurrentPassword(e.target.value)}
                 className="block w-full px-3 py-2.5 rounded-lg border border-slate-300 focus:ring-primary-500 focus:border-primary-500 text-sm"
               />
             </div>
             
             <div>
               <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nueva Contraseña</label>
               <input
                 type="password"
                 required
                 minLength={4}
                 value={newPassword}
                 onChange={(e) => setNewPassword(e.target.value)}
                 className="block w-full px-3 py-2.5 rounded-lg border border-slate-300 focus:ring-primary-500 focus:border-primary-500 text-sm"
               />
             </div>

             <div className="flex justify-end gap-3 pt-2">
               <button
                 type="button"
                 onClick={closeModal}
                 className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50"
               >
                 Cancelar
               </button>
               <button
                 type="submit"
                 disabled={isLoading}
                 className="flex items-center px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold hover:bg-slate-800 disabled:opacity-70"
               >
                 {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                 Actualizar
               </button>
             </div>
         </form>
      </Modal>
    </>
  );
};