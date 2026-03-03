import React, { useState, useEffect } from 'react';
import { ThemeProvider } from './src/context/ThemeContext';
import { User, Stage } from './types';
import { Navbar } from './components/Navbar';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { CalendarView } from './pages/CalendarView';
import { IncidentsPage } from './pages/IncidentsPage';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentStage, setCurrentStage] = useState<Stage | null>(null);
  const [view, setView] = useState<'DASHBOARD' | 'CALENDAR' | 'INCIDENTS'>('DASHBOARD');

  // Check for existing session in localStorage
  useEffect(() => {
    const checkAuth = async () => {
      let localUser = null;
      try {
        const savedUser = localStorage.getItem('hispanidad_user');
        if (savedUser && savedUser !== "undefined" && savedUser !== "null") {
          const parsed = JSON.parse(savedUser);
          if (parsed && parsed.email && parsed.role && parsed.name) {
            localUser = parsed;
          }
        }
      } catch (e) {
        localStorage.removeItem('hispanidad_user');
      }

      // Probar SSO Silencioso
      try {
        const res = await fetch('/api/proxy/me');
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.user) {
            setUser(data.user);
            localStorage.setItem('hispanidad_user', JSON.stringify(data.user));
            return;
          }
        }

        // El servidor respondió (401 u otro): sesión inválida → forzar login
        localStorage.removeItem('hispanidad_user');
        setUser(null);
        return;
      } catch (e) {
        // Error de red: usar datos locales como fallback temporal
        if (localUser) {
          setUser(localUser);
          return;
        }
      }

      setUser(null);
    };

    checkAuth();
  }, []);

  const handleLogin = (newUser: User) => {
    if (!newUser) return; // Protección extra
    setUser(newUser);
    // Aseguramos que nunca guardamos "undefined" como string
    localStorage.setItem('hispanidad_user', JSON.stringify(newUser));
  };

  const handleLogout = () => {
    setUser(null);
    setCurrentStage(null);
    setView('DASHBOARD');
    localStorage.removeItem('hispanidad_user');
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => { });
  };

  const handleSelectStage = (stage: Stage) => {
    setCurrentStage(stage);
    setView('CALENDAR');
  };

  const handleBackToDashboard = () => {
    setCurrentStage(null);
    setView('DASHBOARD');
  };

  const handleNavigate = (newView: 'DASHBOARD' | 'INCIDENTS') => {
    if (newView === 'DASHBOARD') {
      setCurrentStage(null);
    }
    setView(newView);
  };

  const handleBackFromIncidents = () => {
    if (currentStage) {
      setView('CALENDAR');
    } else {
      setView('DASHBOARD');
    }
  };

  // View Logic
  let content;
  if (!user) {
    content = <Login onLogin={handleLogin} />;
  } else if (view === 'INCIDENTS') {
    content = <IncidentsPage onBack={handleBackFromIncidents} />;
  } else if (view === 'CALENDAR' && currentStage) {
    content = (
      <CalendarView
        stage={currentStage}
        user={user}
        onBack={handleBackToDashboard}
      />
    );
  } else {
    content = <Dashboard onSelectStage={handleSelectStage} user={user} />;
  }



  return (
    <ThemeProvider defaultTheme="system" storageKey="hispanidad-theme">
      <div className="min-h-screen font-sans flex flex-col transition-colors duration-300">
        <Navbar user={user} onLogout={handleLogout} onNavigate={handleNavigate} />
        <main className="flex-grow flex flex-col relative">
          {/* Background Mesh (Optional, if we want it global or per page. Login has its own) */}
          {/* <div className="fixed inset-0 z-0 bg-mesh pointer-events-none opacity-30"></div> */}
          <div className="relative z-10 flex-grow flex flex-col">
            {content}
          </div>
        </main>
        {/* Footer is displayed on all pages, but Login has its own integrated footer style for layout reasons */}
        {user && (
          <footer className="glass-light border-t border-glass-border py-4 mt-auto">
            <div className="max-w-7xl mx-auto px-4 flex justify-center items-center text-xs text-muted dark:text-gray-400">
              <span className="font-medium mr-1">Desarrollado por</span>
              <span className="font-bold text-gray-600 dark:text-gray-300">Javier Barrero</span>
            </div>
          </footer>
        )}
      </div>
    </ThemeProvider>
  );
};

export default App;