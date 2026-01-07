import React from 'react';
import { Stage } from '../types';
import { BookOpen, Monitor, ArrowRight } from 'lucide-react';

interface DashboardProps {
  onSelectStage: (stage: Stage) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onSelectStage }) => {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 animate-fade-in pb-20">
      
      {/* Hero Header */}
      <div className="text-center mb-10 md:mb-16 relative">
         <h1 className="text-3xl md:text-5xl font-extrabold text-slate-900 tracking-tight mb-3 md:mb-4">
            ¿Dónde quieres <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-indigo-600">enseñar hoy?</span>
         </h1>
         <p className="text-base md:text-lg text-slate-500 max-w-2xl mx-auto font-medium leading-relaxed px-4">
            Selecciona el espacio adecuado para tu clase. Consulta disponibilidad en tiempo real.
         </p>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 max-w-4xl mx-auto">
        
        {/* Primary Card */}
        <div 
          onClick={() => onSelectStage(Stage.PRIMARY)}
          className="group relative h-[280px] md:h-[320px] rounded-[2rem] overflow-hidden cursor-pointer transition-all duration-500 hover:-translate-y-2 hover:shadow-glass-hover shadow-glass bg-white border border-slate-100"
        >
          {/* Content Layer */}
          <div className="relative z-20 p-6 md:p-8 h-full flex flex-col justify-between">
             <div className="flex justify-between items-start">
                <div className="h-12 w-12 md:h-14 md:w-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 group-hover:scale-110 transition-transform duration-300">
                   <BookOpen className="h-6 w-6 md:h-7 md:w-7" />
                </div>
                <div className="px-3 py-1 bg-white/60 backdrop-blur-md rounded-full text-xs font-bold text-slate-500 border border-slate-100">
                   1º - 6º Primaria
                </div>
             </div>

             <div>
                <h3 className="text-xl md:text-2xl font-bold text-slate-900 mb-1 group-hover:text-blue-700 transition-colors">Etapa Primaria</h3>
                <p className="text-slate-500 font-medium text-sm md:text-base">Aula de Idiomas</p>
             </div>

             <div className="flex items-center justify-between pt-6 border-t border-slate-100/50">
                 <span className="text-xs md:text-sm font-semibold text-slate-400">9:00 - 14:00</span>
                 <span className="h-8 w-8 md:h-10 md:w-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
                    <ArrowRight className="h-4 w-4 md:h-5 md:w-5" />
                 </span>
             </div>
          </div>

          {/* Decorative Gradient Blob */}
          <div className="absolute top-[-50%] right-[-50%] w-[100%] h-[100%] bg-blue-400/10 rounded-full blur-3xl group-hover:bg-blue-400/20 transition-all duration-500"></div>
        </div>

        {/* Secondary Card */}
        <div 
          onClick={() => onSelectStage(Stage.SECONDARY)}
          className="group relative h-[280px] md:h-[320px] rounded-[2rem] overflow-hidden cursor-pointer transition-all duration-500 hover:-translate-y-2 hover:shadow-glass-hover shadow-glass bg-white border border-slate-100"
        >
          {/* Content Layer */}
          <div className="relative z-20 p-6 md:p-8 h-full flex flex-col justify-between">
             <div className="flex justify-between items-start">
                <div className="h-12 w-12 md:h-14 md:w-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 group-hover:scale-110 transition-transform duration-300">
                   <Monitor className="h-6 w-6 md:h-7 md:w-7" />
                </div>
                <div className="px-3 py-1 bg-white/60 backdrop-blur-md rounded-full text-xs font-bold text-slate-500 border border-slate-100">
                   1º - 4º ESO
                </div>
             </div>

             <div>
                <h3 className="text-xl md:text-2xl font-bold text-slate-900 mb-1 group-hover:text-emerald-700 transition-colors">Etapa Secundaria</h3>
                <p className="text-slate-500 font-medium text-sm md:text-base">Aula de Informática</p>
             </div>

             <div className="flex items-center justify-between pt-6 border-t border-slate-100/50">
                 <span className="text-xs md:text-sm font-semibold text-slate-400">8:00 - 14:30</span>
                 <span className="h-8 w-8 md:h-10 md:w-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
                    <ArrowRight className="h-4 w-4 md:h-5 md:w-5" />
                 </span>
             </div>
          </div>

          {/* Decorative Gradient Blob */}
          <div className="absolute top-[-50%] right-[-50%] w-[100%] h-[100%] bg-emerald-400/10 rounded-full blur-3xl group-hover:bg-emerald-400/20 transition-all duration-500"></div>
        </div>

      </div>
    </div>
  );
};