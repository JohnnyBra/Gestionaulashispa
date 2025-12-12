import React, { useState } from 'react';
import { User, Role } from '../types';
import { AlertCircle, Shield, User as UserIcon, Mail, ArrowRight, CheckCircle2 } from 'lucide-react';

interface LoginProps {
  onLogin: (user: User) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [activeTab, setActiveTab] = useState<'teacher' | 'admin'>('teacher');
  const [error, setError] = useState('');
  
  // Teacher Form State
  const [teacherEmail, setTeacherEmail] = useState('');

  // Admin Login State
  const [adminPassword, setAdminPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // --- Manual Teacher Login Logic ---
  const handleTeacherLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!teacherEmail.trim()) {
      setError('Introduce tu email corporativo.');
      return;
    }

    if (!teacherEmail.includes('@')) {
       setError('Formato de email incorrecto.');
       return;
    }

    const localPart = teacherEmail.split('@')[0];
    const nameParts = localPart.split('.');
    
    const formatName = nameParts
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');

    const user: User = {
      email: teacherEmail,
      name: formatName, 
      role: Role.TEACHER
    };
    
    onLogin(user);
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return; 

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword })
      });

      if (!response.ok) {
         const errorData = await response.json();
         throw new Error(errorData.message || 'Error en la autenticación');
      }

      const data = await response.json();

      if (data.success && data.user) {
        onLogin(data.user);
      } else {
        setError('Respuesta del servidor inválida');
      }
    } catch (err: any) {
      console.error("Login Error:", err);
      setError('No se pudo conectar con el servidor.');
    } finally {
      setLoading(false); 
    }
  };

  return (
    <div className="min-h-screen flex w-full">
      {/* LEFT SIDE - BRANDING */}
      <div className="hidden lg:flex w-1/2 bg-slate-900 relative overflow-hidden flex-col justify-between p-16 text-white">
        {/* Background Effects */}
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-slate-900 via-slate-800 to-brand-900 z-0"></div>
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-brand-500 rounded-full mix-blend-multiply filter blur-[128px] opacity-20 animate-blob"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-500 rounded-full mix-blend-multiply filter blur-[128px] opacity-20 animate-blob"></div>
        
        {/* Content */}
        <div className="relative z-10 animate-fade-in">
           <div className="flex items-center space-x-4 mb-8">
              <div className="h-14 w-14 bg-white rounded-2xl flex items-center justify-center shadow-lg">
                <img src="/logo.png" alt="Logo" className="h-10 w-auto object-contain" />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight">La Hispanidad</h2>
                <p className="text-brand-200 text-sm font-medium tracking-widest uppercase">Portal Docente</p>
              </div>
           </div>
        </div>

        <div className="relative z-10 max-w-lg animate-slide-up">
            <h1 className="text-5xl font-extrabold tracking-tight leading-tight mb-6">
              Gestiona tus espacios <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-300 to-indigo-300">sin complicaciones.</span>
            </h1>
            <p className="text-slate-400 text-lg leading-relaxed mb-8">
              Plataforma centralizada para la reserva y gestión de aulas de informática e idiomas. Optimizando el tiempo de enseñanza.
            </p>
            
            <div className="flex space-x-8 text-sm font-medium text-slate-400">
               <div className="flex items-center"><CheckCircle2 className="w-4 h-4 mr-2 text-brand-400"/> Acceso Instantáneo</div>
               <div className="flex items-center"><CheckCircle2 className="w-4 h-4 mr-2 text-brand-400"/> Gestión en Tiempo Real</div>
            </div>
        </div>

        <div className="relative z-10 text-xs text-slate-500 font-medium">
           &copy; {new Date().getFullYear()} Colegio La Hispanidad. Todos los derechos reservados.
        </div>
      </div>

      {/* RIGHT SIDE - FORM */}
      <div className="w-full lg:w-1/2 bg-white flex items-center justify-center p-8 lg:p-16 relative">
         <div className="w-full max-w-md animate-scale-in">
            {/* Mobile Logo */}
            <div className="lg:hidden flex justify-center mb-8">
                <div className="h-16 w-16 bg-slate-50 rounded-2xl flex items-center justify-center shadow-sm border border-slate-100">
                   <img src="/logo.png" alt="Logo" className="h-10 w-auto object-contain" />
                </div>
            </div>

            <div className="text-center lg:text-left mb-10">
               <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Bienvenido</h2>
               <p className="text-slate-500 mt-2">Introduce tus credenciales para acceder.</p>
            </div>

            {/* Tabs */}
            <div className="grid grid-cols-2 p-1 bg-slate-100/80 rounded-xl mb-8">
              <button
                onClick={() => { setActiveTab('teacher'); setError(''); }}
                className={`py-2.5 text-sm font-bold rounded-lg transition-all duration-200 ${
                  activeTab === 'teacher' 
                    ? 'bg-white text-slate-900 shadow-sm ring-1 ring-black/5' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Profesorado
              </button>
              <button
                onClick={() => { setActiveTab('admin'); setError(''); }}
                className={`py-2.5 text-sm font-bold rounded-lg transition-all duration-200 ${
                  activeTab === 'admin' 
                    ? 'bg-white text-slate-900 shadow-sm ring-1 ring-black/5' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Dirección
              </button>
            </div>

            {error && (
               <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-700 text-sm font-medium animate-pulse-soft">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>{error}</span>
               </div>
            )}

            {activeTab === 'teacher' ? (
                <form onSubmit={handleTeacherLogin} className="space-y-5">
                   <div className="space-y-1.5">
                      <label className="block text-sm font-semibold text-slate-700">Email Corporativo</label>
                      <div className="relative group">
                         <Mail className="absolute left-4 top-3.5 h-5 w-5 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
                         <input
                           type="email"
                           value={teacherEmail}
                           onChange={(e) => setTeacherEmail(e.target.value)}
                           className="block w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-medium"
                           placeholder="nombre.apellido@..."
                           required
                         />
                      </div>
                   </div>
                   <button
                    type="submit"
                    className="w-full flex items-center justify-center py-3.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                   >
                     Entrar <ArrowRight className="w-4 h-4 ml-2" />
                   </button>
                </form>
            ) : (
                <form onSubmit={handleAdminLogin} className="space-y-5">
                   <div className="space-y-1.5">
                      <label className="block text-sm font-semibold text-slate-700">Contraseña Maestra</label>
                      <div className="relative group">
                         <Shield className="absolute left-4 top-3.5 h-5 w-5 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
                         <input
                           type="password"
                           value={adminPassword}
                           onChange={(e) => setAdminPassword(e.target.value)}
                           className="block w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900 transition-all font-medium"
                           placeholder="••••••••"
                           required
                         />
                      </div>
                   </div>
                   <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center py-3.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed"
                   >
                     {loading ? 'Verificando...' : 'Acceder al Panel'}
                     {!loading && <ArrowRight className="w-4 h-4 ml-2" />}
                   </button>
                </form>
            )}

            <p className="mt-8 text-center text-xs text-slate-400 font-medium">
                ¿Problemas para acceder? Contacta con soporte TIC.
            </p>
         </div>
      </div>
    </div>
  );
};