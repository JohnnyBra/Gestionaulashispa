import React from 'react';
import { Stage } from '../types';
import { BookOpen, Monitor, Calendar, ArrowRight } from 'lucide-react';

interface DashboardProps {
  onSelectStage: (stage: Stage) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onSelectStage }) => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 animate-fade-in">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-extrabold text-slate-900 sm:text-5xl tracking-tight mb-4">
          Espacios Comunes
        </h1>
        <p className="max-w-2xl mx-auto text-xl text-slate-500">
          Selecciona el aula que deseas reservar para comprobar su disponibilidad en tiempo real.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
        {/* Primary Card */}
        <div 
          onClick={() => onSelectStage(Stage.PRIMARY)}
          className="group relative bg-white rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300 cursor-pointer overflow-hidden ring-1 ring-slate-200 hover:ring-blue-400"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          
          <div className="relative p-8 h-full flex flex-col items-center text-center z-10">
            <div className="h-24 w-24 bg-blue-50 rounded-2xl flex items-center justify-center mb-8 group-hover:bg-white group-hover:scale-110 transition-all duration-300 shadow-sm">
              <BookOpen className="h-12 w-12 text-blue-600 group-hover:text-blue-500 transition-colors" />
            </div>
            
            <h3 className="text-3xl font-bold text-slate-900 group-hover:text-white mb-2 transition-colors">Primaria</h3>
            <p className="text-lg font-medium text-blue-600 group-hover:text-blue-100 mb-6 transition-colors">Aula de Idiomas</p>
            
            <div className="bg-slate-50 group-hover:bg-white/10 rounded-xl p-4 w-full mb-8 backdrop-blur-sm transition-colors border border-slate-100 group-hover:border-white/20">
              <ul className="text-sm text-slate-600 group-hover:text-white space-y-2">
                <li className="flex items-center justify-center"><span className="w-1.5 h-1.5 rounded-full bg-blue-400 group-hover:bg-white mr-2"></span>Cursos: 1º a 6º Primaria</li>
                <li className="flex items-center justify-center"><span className="w-1.5 h-1.5 rounded-full bg-blue-400 group-hover:bg-white mr-2"></span>Mañana (9:00 - 14:00)</li>
              </ul>
            </div>

            <span className="mt-auto inline-flex items-center px-6 py-3 border border-transparent text-base font-semibold rounded-full text-white bg-blue-600 group-hover:bg-white group-hover:text-blue-600 shadow-lg hover:shadow-xl transition-all transform group-hover:-translate-y-1">
              Ver Calendario
              <ArrowRight className="ml-2 h-4 w-4" />
            </span>
          </div>
        </div>

        {/* Secondary Card */}
        <div 
          onClick={() => onSelectStage(Stage.SECONDARY)}
          className="group relative bg-white rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300 cursor-pointer overflow-hidden ring-1 ring-slate-200 hover:ring-emerald-400"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-teal-400 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          
          <div className="relative p-8 h-full flex flex-col items-center text-center z-10">
            <div className="h-24 w-24 bg-emerald-50 rounded-2xl flex items-center justify-center mb-8 group-hover:bg-white group-hover:scale-110 transition-all duration-300 shadow-sm">
              <Monitor className="h-12 w-12 text-emerald-600 group-hover:text-emerald-500 transition-colors" />
            </div>
            
            <h3 className="text-3xl font-bold text-slate-900 group-hover:text-white mb-2 transition-colors">Secundaria</h3>
            <p className="text-lg font-medium text-emerald-600 group-hover:text-emerald-100 mb-6 transition-colors">Aula de Informática</p>
            
            <div className="bg-slate-50 group-hover:bg-white/10 rounded-xl p-4 w-full mb-8 backdrop-blur-sm transition-colors border border-slate-100 group-hover:border-white/20">
              <ul className="text-sm text-slate-600 group-hover:text-white space-y-2">
                <li className="flex items-center justify-center"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 group-hover:bg-white mr-2"></span>Cursos: 1º a 4º ESO</li>
                <li className="flex items-center justify-center"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 group-hover:bg-white mr-2"></span>Mañana (8:00 - 14:30)</li>
              </ul>
            </div>

            <span className="mt-auto inline-flex items-center px-6 py-3 border border-transparent text-base font-semibold rounded-full text-white bg-emerald-600 group-hover:bg-white group-hover:text-emerald-600 shadow-lg hover:shadow-xl transition-all transform group-hover:-translate-y-1">
              Ver Calendario
              <ArrowRight className="ml-2 h-4 w-4" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};