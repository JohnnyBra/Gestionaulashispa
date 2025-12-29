
import React, { useState } from 'react';
import { User } from '../types';
import { loginExternal } from '../services/storageService';
import { AlertCircle, Shield, Mail, ArrowRight, Lock, Loader2 } from 'lucide-react';

interface LoginProps {
  onLogin: (user: User) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await loginExternal({ email, password });
      if (result.success) {
        onLogin(result.user);
      } else {
        setError(result.message || 'Credenciales incorrectas.');
      }
    } catch (err) {
      setError('Error al conectar con el servidor de autenticación.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row w-full bg-slate-50 lg:bg-white overflow-hidden">
      <div className="w-full h-[30vh] lg:h-auto lg:w-1/2 bg-slate-900 relative flex flex-col justify-center p-8 lg:p-16 text-white shrink-0">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-brand-900 z-0"></div>
        <div className="relative z-10 animate-fade-in text-center lg:text-left">
           <div className="flex flex-col lg:flex-row items-center lg:space-x-4 mb-8">
              <div className="h-16 w-16 bg-white rounded-2xl flex items-center justify-center shadow-lg mb-4 lg:mb-0">
                <img src="/logo.png" alt="Logo" className="h-10 w-auto" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">La Hispanidad</h2>
                <p className="text-brand-200 text-sm font-medium tracking-widest uppercase">Gestión Centralizada</p>
              </div>
           </div>
           <h1 className="hidden lg:block text-4xl font-extrabold leading-tight">Acceso Unificado mediante <span className="text-brand-400">PrismaEdu</span></h1>
        </div>
      </div>

      <div className="w-full flex-1 flex items-center justify-center p-8 z-20">
         <div className="w-full max-w-md animate-scale-in">
            <div className="mb-8 text-center lg:text-left">
               <h2 className="text-3xl font-bold text-slate-900">Iniciar Sesión</h2>
               <p className="text-slate-500 mt-2">Usa tu cuenta corporativa de la cooperativa.</p>
            </div>

            {error && (
               <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-700 text-sm font-medium">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>{error}</span>
               </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
               <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email</label>
                  <div className="relative">
                     <Mail className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                     <input
                       type="email"
                       value={email}
                       onChange={(e) => setEmail(e.target.value)}
                       className="block w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all outline-none"
                       placeholder="usuario@colegiolahispanidad.es"
                       required
                     />
                  </div>
               </div>
               <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Contraseña</label>
                  <div className="relative">
                     <Lock className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                     <input
                       type="password"
                       value={password}
                       onChange={(e) => setPassword(e.target.value)}
                       className="block w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all outline-none"
                       placeholder="••••••••"
                       required
                     />
                  </div>
               </div>
               <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-all shadow-lg disabled:opacity-70"
               >
                 {loading ? <Loader2 className="animate-spin w-5 h-5 mr-2" /> : 'Entrar'}
                 {!loading && <ArrowRight className="w-4 h-4 ml-2" />}
               </button>
            </form>
         </div>
      </div>
    </div>
  );
};
