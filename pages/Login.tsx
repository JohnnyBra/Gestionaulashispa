import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { loginExternal, loginGoogle } from '../services/storageService';
import { AlertCircle, Mail, ArrowRight, Lock, Loader2, ArrowLeft, Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../src/context/ThemeContext';

interface LoginProps {
  onLogin: (user: User) => void;
}

declare global {
  interface Window {
    google: any;
  }
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const { theme, setTheme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Configuración de Google OAuth desde variables de entorno
  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const isGoogleEnabled = !!GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!isGoogleEnabled) return;

    const initializeGoogle = () => {
      if (window.google && window.google.accounts) {
        try {
          window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleGoogleResponse
          });

          const buttonDiv = document.getElementById("googleButtonDiv");
          if (buttonDiv) {
            window.google.accounts.id.renderButton(
              buttonDiv,
              { theme: "outline", size: "large", width: "100%", text: "continue_with" }
            );
          }
          return true;
        } catch (e) {
          console.warn("Error inicializando Google Auth:", e);
          return false;
        }
      }
      return false;
    };

    if (!initializeGoogle()) {
      const intervalId = setInterval(() => {
        if (initializeGoogle()) {
          clearInterval(intervalId);
        }
      }, 100);

      return () => clearInterval(intervalId);
    }
  }, [isGoogleEnabled]);

  const handleGoogleResponse = async (response: any) => {
    setLoading(true);
    setError('');
    try {
      const result = await loginGoogle(response.credential);
      if (result.success && result.email) {
        onLogin({
          name: result.name || 'Usuario Google',
          email: result.email,
          role: result.role
        });
      } else {
        setError(result.message || 'Error al validar con Google.');
      }
    } catch (err) {
      setError('Error de conexión validando Google.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await loginExternal({ email, password });

      if (result && result.success) {
        const safeUser: User = {
          name: result.name || email.split('@')[0] || 'Usuario',
          email: result.email || email,
          role: result.role
        };
        onLogin(safeUser);
      } else {
        setError(result.message || 'Credenciales incorrectas.');
      }
    } catch (err) {
      console.error("Login error:", err);
      setError('Error al conectar con el servidor de autenticación.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row w-full overflow-hidden relative transition-colors duration-300">

      {/* Botón Volver a Prisma (Flotante en Desktop, Flujo en Mobile) */}
      <div className="lg:absolute lg:top-8 lg:right-8 z-50 p-4 lg:p-0 flex justify-center items-center gap-3 lg:block glass-light lg:bg-transparent lg:border-none lg:backdrop-blur-none border-b border-glass-border">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light')}
            className="p-2 text-muted glass hover:bg-glass-bg rounded-full transition-all duration-200 hover:scale-105"
            title={theme === 'dark' ? 'Modo oscuro' : theme === 'light' ? 'Modo claro' : 'Modo sistema'}
          >
            {theme === 'dark' ? <Moon size={18} /> : theme === 'light' ? <Sun size={18} /> : <Monitor size={18} />}
          </button>
          <a
            href="https://prisma.bibliohispa.es"
            className="flex items-center gap-2 px-4 py-2 glass text-muted hover:text-primary-600 dark:hover:text-primary-400 rounded-full transition-all text-xs md:text-sm font-bold group"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 transition-transform group-hover:-translate-x-1">
              <rect width="7" height="7" x="3" y="3" rx="1" />
              <rect width="7" height="7" x="14" y="3" rx="1" fill="#3b82f6" stroke="#3b82f6" />
              <rect width="7" height="7" x="14" y="14" rx="1" />
              <rect width="7" height="7" x="3" y="14" rx="1" />
            </svg>
            <span>Volver a Prisma</span>
          </a>
        </div>
      </div>

      <div className="w-full h-[25vh] lg:h-auto lg:w-1/2 mesh-auth relative flex flex-col justify-center p-8 lg:p-16 text-white shrink-0">
        <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px] z-0"></div>
        <div className="relative z-10 animate-fade-in text-center lg:text-left">
          <div className="flex flex-col lg:flex-row items-center justify-center lg:justify-start lg:space-x-5 mb-4 lg:mb-8">
            <div className="h-16 w-16 lg:h-20 lg:w-20 bg-white rounded-2xl lg:rounded-3xl flex items-center justify-center shadow-xl ring-1 ring-white/20 mb-3 lg:mb-0">
              <img src="/logo.png" alt="Logo" className="h-11 w-auto lg:h-14 object-contain" />
            </div>
            <div>
              <h2 className="text-2xl lg:text-3xl font-bold font-display">La Hispanidad</h2>
              <p className="text-primary-200 text-xs lg:text-sm font-medium tracking-widest uppercase">Gestión Centralizada</p>
            </div>
          </div>
          <h1 className="hidden lg:block text-4xl font-extrabold leading-tight">Acceso Unificado mediante <span className="text-primary-400">PrismaEdu</span></h1>
        </div>
      </div>

      <div className="w-full flex-1 flex items-center justify-center p-6 md:p-8 z-20">
        <div className="w-full max-w-md animate-scale-in glass-medium p-8 rounded-3xl shadow-glass-lg">
          <div className="mb-6 lg:mb-8 text-center lg:text-left">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white font-display">Iniciar Sesión</h2>
            <p className="text-muted mt-2 text-sm md:text-base">Usa tu cuenta corporativa de la cooperativa.</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-xl flex items-start gap-3 text-red-700 dark:text-red-400 text-sm font-medium animate-slide-up">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {isGoogleEnabled && (
            <div className="mb-6">
              <div id="googleButtonDiv" className="w-full h-[44px]"></div>
              <div className="relative mt-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-glass-border"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-3 py-0.5 glass-light rounded-full text-muted text-xs font-medium">O usa tu contraseña</span>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-3.5 h-5 w-5 text-muted" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-11 pr-4 py-3 input-glass"
                  placeholder="usuario@colegiolahispanidad.es"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-4 top-3.5 h-5 w-5 text-muted" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-11 pr-4 py-3 input-glass"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center btn-primary"
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