import React, { useState } from 'react';
import { User, Role } from '../types';
import { AlertCircle, Shield, School, User as UserIcon, Mail } from 'lucide-react';

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
      setError('Por favor, introduce tu email corporativo.');
      return;
    }

    if (!teacherEmail.includes('@')) {
       setError('Formato de email no válido (falta @).');
       return;
    }

    // Logic to extract name from email: nombre.apellido@...
    const localPart = teacherEmail.split('@')[0];
    const nameParts = localPart.split('.');
    
    // Capitalize each part of the name
    const formatName = nameParts
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');

    const user: User = {
      email: teacherEmail,
      name: formatName, // Derived from email
      role: Role.TEACHER
    };
    
    onLogin(user);
  };

  // --- Admin Login Logic ---
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return; // Prevent double submit

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword })
      });

      // Check if response is ok
      if (!response.ok) {
         // If 404, it means server is not running API, try local fallback
         if (response.status === 404) {
             throw new Error('SERVER_OFFLINE');
         }
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
      console.warn("Login Error (intentando fallback local):", err);
      
      // FALLBACK LOCAL PARA MODO SIN SERVIDOR
      // Contraseña por defecto: adminhispanidad
      // O la que esté guardada en localStorage
      const localAdminPass = localStorage.getItem('hispanidad_admin_pass') || 'adminhispanidad';
      
      if (adminPassword === localAdminPass) {
          onLogin({
            email: 'direccion@colegiolahispanidad.es', 
            name: 'Administración (Local)', 
            role: Role.ADMIN 
          });
      } else {
          setError('Contraseña incorrecta (Modo Local/Offline).');
      }
    } finally {
      setLoading(false); 
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-100">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden animate-slide-up border border-slate-200 relative">
        
        {/* Header Section */}
        <div className="bg-primary-700 p-8 pb-10 text-center relative overflow-hidden">
             {/* Abstract background shapes */}
             <div className="absolute top-0 left-0 w-full h-full opacity-10">
                <div className="absolute top-[-50px] left-[-50px] w-32 h-32 rounded-full bg-white blur-2xl"></div>
                <div className="absolute bottom-[-20px] right-[-20px] w-40 h-40 rounded-full bg-white blur-3xl"></div>
             </div>

            <div className="relative z-10 flex flex-col items-center">
                <div className="bg-white p-3 rounded-2xl shadow-lg mb-4">
                    <School className="w-8 h-8 text-primary-700" />
                </div>
                <h1 className="text-2xl font-extrabold text-white tracking-tight">La Hispanidad</h1>
                <p className="text-primary-100 text-sm font-medium mt-1">Gestión de Espacios</p>
            </div>
        </div>

        <div className="px-6 py-8 relative -mt-6 bg-white rounded-t-3xl">
            {/* Tabs */}
            <div className="grid grid-cols-2 gap-1 p-1.5 bg-slate-100 rounded-xl mb-8 border border-slate-200">
              <button
                type="button"
                onClick={() => { setActiveTab('teacher'); setError(''); }}
                className={`py-2.5 text-sm font-bold rounded-lg transition-all duration-200 ${
                  activeTab === 'teacher' 
                    ? 'bg-white text-primary-700 shadow-md ring-1 ring-black/5' 
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                }`}
              >
                Profesorado
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab('admin'); setError(''); }}
                className={`py-2.5 text-sm font-bold rounded-lg transition-all duration-200 ${
                  activeTab === 'admin' 
                    ? 'bg-white text-slate-900 shadow-md ring-1 ring-black/5' 
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                }`}
              >
                Dirección
              </button>
            </div>

            <div className="min-h-[220px]">
              {error && (
                <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg flex items-start gap-3 animate-pulse-soft">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <span className="text-sm font-semibold text-red-800 leading-snug">{error}</span>
                </div>
              )}

              {activeTab === 'teacher' ? (
                <form onSubmit={handleTeacherLogin} className="space-y-6 animate-fade-in">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                        Email Corporativo
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Mail className="h-6 w-6 text-slate-400" />
                      </div>
                      <input
                        type="email"
                        value={teacherEmail}
                        onChange={(e) => setTeacherEmail(e.target.value)}
                        className="block w-full pl-12 pr-4 py-4 text-base bg-white border-2 border-slate-300 rounded-xl text-slate-900 placeholder-slate-500 focus:outline-none focus:border-primary-600 focus:ring-1 focus:ring-primary-600 transition-colors shadow-sm"
                        placeholder="nombre.apellido@..."
                        autoComplete="email"
                        required
                      />
                    </div>
                    <p className="mt-2 text-xs text-slate-500 font-medium ml-1">
                        Usa tu correo @colegiolahispanidad.es
                    </p>
                  </div>

                  <button
                    type="submit"
                    className="w-full flex justify-center py-4 px-4 border border-transparent text-base font-bold rounded-xl text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-4 focus:ring-primary-100 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0"
                  >
                    Entrar como Profesor
                  </button>
                </form>
              ) : (
                <form onSubmit={handleAdminLogin} className="space-y-6 animate-fade-in">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                        Contraseña de Administración
                    </label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Shield className="h-6 w-6 text-slate-400" />
                        </div>
                        <input
                        type="password"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        className="block w-full pl-12 pr-4 py-4 text-base bg-white border-2 border-slate-300 rounded-xl text-slate-900 placeholder-slate-500 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-colors shadow-sm"
                        placeholder="••••••••"
                        autoComplete="current-password"
                        required
                        />
                    </div>
                  </div>
                  
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex justify-center py-4 px-4 border border-transparent text-base font-bold rounded-xl text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-200 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Verificando...' : 'Acceder al Panel de Control'}
                  </button>
                </form>
              )}
            </div>
        </div>
      </div>
      
      <div className="fixed bottom-0 left-0 w-full p-4 text-center bg-slate-100/80 backdrop-blur-sm border-t border-slate-200">
         <p className="text-xs text-slate-400 font-medium">
            &copy; {new Date().getFullYear()} Javier Barrero
         </p>
      </div>
    </div>
  );
};