import React, { useState, useEffect } from 'react';
import { Stage, User, Booking, SLOTS_PRIMARY, SLOTS_SECONDARY } from '../types';
import { BookOpen, Monitor, ArrowRight, Calendar, Loader2, Clock } from 'lucide-react';
import { getBookings } from '../services/storageService';
import { getUserUpcomingBookings, getFreeSlots } from '../utils/dashboardUtils';
import { formatDisplayDate } from '../utils/dateUtils';

interface DashboardProps {
   onSelectStage: (stage: Stage) => void;
   user: User;
}

export const Dashboard: React.FC<DashboardProps> = ({ onSelectStage, user }) => {
   const [bookings, setBookings] = useState<Booking[]>([]);
   const [loading, setLoading] = useState(true);

   useEffect(() => {
      const fetchBookings = async () => {
         try {
            const data = await getBookings();
            setBookings(data);
         } catch (e) {
            console.error("Error fetching bookings for dashboard", e);
         } finally {
            setLoading(false);
         }
      };
      fetchBookings();
   }, []);

   const upcomingBookings = getUserUpcomingBookings(bookings, user);
   const freeSlotsPrimary = getFreeSlots(bookings, Stage.PRIMARY);
   const freeSlotsSecondary = getFreeSlots(bookings, Stage.SECONDARY);

   const getSlotLabel = (stage: Stage, slotId: string) => {
      const slots = stage === Stage.PRIMARY ? SLOTS_PRIMARY : SLOTS_SECONDARY;
      const slot = slots.find(s => s.id === slotId);
      return slot ? slot.label : slotId;
   };

   return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 animate-fade-in pb-20">

         {/* Hero Header */}
         <div className="text-center mb-8 md:mb-12 relative">
            <h1 className="text-3xl md:text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-3 md:mb-4 font-display">
               Hola, <span className="gradient-text">{user.name.split(' ')[0]}</span>
            </h1>
            <p className="text-base md:text-lg text-slate-500 max-w-2xl mx-auto font-medium leading-relaxed px-4">
               ¿Dónde quieres enseñar hoy? Selecciona tu espacio.
            </p>
         </div>

         {/* User Upcoming Bookings */}
         {upcomingBookings.length > 0 && (
            <div className="mb-10 max-w-4xl mx-auto">
               <div className="flex items-center gap-2 mb-4 px-1">
                  <Calendar className="w-5 h-5 text-slate-400" />
                  <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Mis Próximas Reservas</h2>
               </div>
               <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {upcomingBookings.map((booking, idx) => (
                     <div key={booking.id} className={`glass p-4 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 animate-slide-up stagger-${Math.min(idx + 1, 8)}`}>
                        <div className="flex items-center justify-between mb-2">
                           <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${booking.stage === Stage.PRIMARY ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                              {booking.resource === 'CART' ? 'Carro' : booking.stage === Stage.PRIMARY ? 'Idiomas' : 'Informática'}
                           </span>
                           <span className="text-[10px] font-bold text-slate-400">{getSlotLabel(booking.stage, booking.slotId)}</span>
                        </div>
                        <p className="font-bold text-gray-800 dark:text-gray-200 text-sm mb-1 capitalize">{formatDisplayDate(new Date(booking.date))}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium truncate">{booking.course} - {booking.subject}</p>
                     </div>
                  ))}
               </div>
            </div>
         )}

         {/* Cards Grid */}
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 max-w-4xl mx-auto">

            {/* Primary Card */}
            <div
               onClick={() => onSelectStage(Stage.PRIMARY)}
               className="group relative h-[380px] md:h-[420px] rounded-[2rem] overflow-hidden cursor-pointer transition-all duration-500 hover:-translate-y-2 glass-medium border-glass-border flex flex-col animate-slide-up stagger-1 glow-border-blue"
            >
               {/* Content Layer */}
               <div className="relative z-20 p-6 md:p-8 flex-grow flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                     <div className="h-12 w-12 md:h-14 md:w-14 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-100 dark:border-blue-800 group-hover:scale-110 transition-transform duration-300">
                        <BookOpen className="h-6 w-6 md:h-7 md:w-7" />
                     </div>
                     <div className="px-3 py-1 bg-white/60 dark:bg-slate-800/60 backdrop-blur-md rounded-full text-xs font-bold text-slate-500 dark:text-slate-300 border border-slate-100 dark:border-slate-700">
                        1º - 6º Primaria
                     </div>
                  </div>

                  <div>
                     <h3 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white mb-1 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">Etapa Primaria</h3>
                     <p className="text-slate-500 dark:text-slate-400 font-medium text-sm md:text-base">Aula de Idiomas</p>
                  </div>

                  <div className="flex items-center justify-between pt-6 border-t border-slate-100/50 dark:border-slate-700/50">
                     <span className="text-xs md:text-sm font-semibold text-slate-400">9:00 - 14:00</span>
                     <span className="h-8 w-8 md:h-10 md:w-10 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
                        <ArrowRight className="h-4 w-4 md:h-5 md:w-5" />
                     </span>
                  </div>
               </div>

               {/* Stacked Footer */}
               <div className="relative w-full z-30 glass-light border-t border-glass-border flex flex-col">
                  <div className="w-full py-2 flex items-center justify-center glass border-b border-glass-border">
                     <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400">
                        <Clock className="w-3 h-3 md:w-4 md:h-4" />
                        <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider">Próximos Huecos</span>
                     </div>
                  </div>
                  <div className="w-full h-8 flex items-center overflow-hidden relative">
                     <div className="animate-marquee whitespace-nowrap flex items-center gap-8 text-[10px] md:text-xs font-semibold text-slate-500 dark:text-slate-400 px-4">
                        <span>{freeSlotsPrimary}</span>
                        <span aria-hidden="true">{freeSlotsPrimary}</span>
                        <span aria-hidden="true">{freeSlotsPrimary}</span>
                     </div>
                  </div>
               </div>

               {/* Decorative Gradient Blob */}
               <div className="absolute top-[-50%] right-[-50%] w-[100%] h-[100%] bg-blue-400/10 rounded-full blur-3xl group-hover:bg-blue-400/20 transition-all duration-500 pointer-events-none"></div>
            </div>

            {/* Secondary Card */}
            <div
               onClick={() => onSelectStage(Stage.SECONDARY)}
               className="group relative h-[380px] md:h-[420px] rounded-[2rem] overflow-hidden cursor-pointer transition-all duration-500 hover:-translate-y-2 glass-medium border-glass-border flex flex-col animate-slide-up stagger-2 glow-border-green"
            >
               {/* Content Layer */}
               <div className="relative z-20 p-6 md:p-8 flex-grow flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                     <div className="h-12 w-12 md:h-14 md:w-14 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-100 dark:border-emerald-800 group-hover:scale-110 transition-transform duration-300">
                        <Monitor className="h-6 w-6 md:h-7 md:w-7" />
                     </div>
                     <div className="px-3 py-1 bg-white/60 dark:bg-slate-800/60 backdrop-blur-md rounded-full text-xs font-bold text-slate-500 dark:text-slate-300 border border-slate-100 dark:border-slate-700">
                        1º - 4º ESO
                     </div>
                  </div>

                  <div>
                     <h3 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white mb-1 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">Etapa Secundaria</h3>
                     <p className="text-slate-500 dark:text-slate-400 font-medium text-sm md:text-base">Aula de Informática & Carro</p>
                  </div>

                  <div className="flex items-center justify-between pt-6 border-t border-slate-100/50 dark:border-slate-700/50">
                     <span className="text-xs md:text-sm font-semibold text-slate-400">8:00 - 14:30</span>
                     <span className="h-8 w-8 md:h-10 md:w-10 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
                        <ArrowRight className="h-4 w-4 md:h-5 md:w-5" />
                     </span>
                  </div>
               </div>

               {/* Stacked Footer */}
               <div className="relative w-full z-30 glass-light border-t border-glass-border flex flex-col">
                  <div className="w-full py-2 flex items-center justify-center glass border-b border-glass-border">
                     <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                        <Clock className="w-3 h-3 md:w-4 md:h-4" />
                        <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider">Próximos Huecos</span>
                     </div>
                  </div>
                  <div className="w-full h-8 flex items-center overflow-hidden relative">
                     <div className="animate-marquee whitespace-nowrap flex items-center gap-8 text-[10px] md:text-xs font-semibold text-slate-500 dark:text-slate-400 px-4">
                        <span>{freeSlotsSecondary}</span>
                        <span aria-hidden="true">{freeSlotsSecondary}</span>
                        <span aria-hidden="true">{freeSlotsSecondary}</span>
                     </div>
                  </div>
               </div>

               {/* Decorative Gradient Blob */}
               <div className="absolute top-[-50%] right-[-50%] w-[100%] h-[100%] bg-emerald-400/10 rounded-full blur-3xl group-hover:bg-emerald-400/20 transition-all duration-500 pointer-events-none"></div>
            </div>

         </div>
      </div>
   );
};
