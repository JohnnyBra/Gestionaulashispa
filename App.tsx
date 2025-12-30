import React, { useState, useEffect } from 'react';
import { User, Stage } from './types';
import { Navbar } from './components/Navbar';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { CalendarView } from './pages/CalendarView';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentStage, setCurrentStage] = useState<Stage | null>(null);

  // Check for existing session in localStorage
  useEffect(() => {
    const savedUser = localStorage.getItem('hispanidad_user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        // Validamos que el objeto tenga lo mínimo necesario
        if (parsed && parsed.email && parsed.role && parsed.name) {
            setUser(parsed);
        } else {
            // Si está corrupto (ej. falta name), limpiamos para forzar login limpio
            console.warn("Datos de sesión inválidos, cerrando sesión.");
            localStorage.removeItem('hispanidad_user');
            setUser(null);
        }
      } catch (e) {
        localStorage.removeItem('hispanidad_user');
        setUser(null);
      }
    }
  }, []);

  const handleLogin = (newUser: User) => {
    setUser(newUser);
    localStorage.setItem('hispanidad_user', JSON.stringify(newUser));
  };

  const handleLogout = () => {
    setUser(null);
    setCurrentStage(null);
    localStorage.removeItem('hispanidad_user');
  };

  const handleSelectStage = (stage: Stage) => {
    setCurrentStage(stage);
  };

  const handleBackToDashboard = () => {
    setCurrentStage(null);
  };

  // View Logic
  let content;
  if (!user) {
    content = <Login onLogin={handleLogin} />;
  } else if (!currentStage) {
    content = <Dashboard onSelectStage={handleSelectStage} />;
  } else {
    content = (
      <CalendarView 
        stage={currentStage} 
        user={user} 
        onBack={handleBackToDashboard} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col">
      <Navbar user={user} onLogout={handleLogout} />
      <main className="flex-grow flex flex-col">
        {content}
      </main>
      {/* Footer is displayed on all pages, but Login has its own integrated footer style for layout reasons */}
      {user && (
        <footer className="bg-white/50 backdrop-blur-sm border-t border-slate-200 py-4 mt-auto">
            <div className="max-w-7xl mx-auto px-4 flex justify-center items-center text-xs text-slate-400">
               <span className="font-medium mr-1">Desarrollado por</span>
               <span className="font-bold text-slate-600">Javier Barrero</span>
            </div>
        </footer>
      )}
    </div>
  );
};

export default App;