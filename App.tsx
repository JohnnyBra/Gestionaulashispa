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
      setUser(JSON.parse(savedUser));
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
      <main className="flex-grow">
        {content}
      </main>
      <footer className="bg-white border-t border-slate-200 py-6 mt-8">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center text-sm text-slate-400">
          <div>
             Gestión de Espacios Escolares
          </div>
          <div className="mt-2 md:mt-0 font-medium text-slate-300">
            &copy; {new Date().getFullYear()} Javier Barrero
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;