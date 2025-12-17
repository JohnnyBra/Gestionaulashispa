import React, { useState, useEffect, useMemo } from 'react';
import { Stage, User, TimeSlot, Booking, SLOTS_PRIMARY, SLOTS_SECONDARY, COURSES_PRIMARY, COURSES_SECONDARY, Role } from '../types';
import { getBookings, saveBooking, saveBatchBookings, removeBooking } from '../services/storageService';
import { formatDate, getWeekDays, isBookableDay } from '../utils/dateUtils';
import { Modal } from '../components/Modal';
import { HistoryModal } from '../components/HistoryModal';
import { ChevronLeft, ChevronRight, Lock, User as UserIcon, Book, ArrowLeft, Trash2, Loader2, Clock, History, AlertTriangle, Calendar as CalendarIcon, WifiOff, RefreshCw, Repeat, CalendarDays, MoreHorizontal, Filter, Search, XCircle } from 'lucide-react';
import { addWeeks, subWeeks, format, isSameDay, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { io } from 'socket.io-client';

interface CalendarViewProps {
  stage: Stage;
  user: User;
  onBack: () => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ stage, user, onBack }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ date: Date, slot: TimeSlot } | null>(null);
  const [existingBooking, setExistingBooking] = useState<Booking | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // --- Admin Filters & Tools State ---
  const [teacherFilter, setTeacherFilter] = useState('');
  const [courseFilter, setCourseFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Form State
  const [course, setCourse] = useState('');
  const [subject, setSubject] = useState('');
  const [teacherName, setTeacherName] = useState(user.name);
  const [blockReason, setBlockReason] = useState('');
  const [isBlocking, setIsBlocking] = useState(false);
  
  // Recurring State
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringEndDate, setRecurringEndDate] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  const slots = stage === Stage.PRIMARY ? SLOTS_PRIMARY : SLOTS_SECONDARY;
  const courses = stage === Stage.PRIMARY ? COURSES_PRIMARY : COURSES_SECONDARY;
  const roomName = stage === Stage.PRIMARY ? 'Aula de Idiomas' : 'Aula de Informática';
  
  // Configuración de colores dinámica
  const colors = stage === Stage.PRIMARY 
    ? { primary: 'blue', text: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', gradient: 'from-blue-600 to-indigo-600' }
    : { primary: 'emerald', text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', gradient: 'from-emerald-600 to-teal-600' };

  const loadData = async () => {
    // Si ya hay datos, hacemos carga silenciosa (sin loading spinner global) para no parpadear
    if (bookings.length === 0) setLoading(true);
    setError(null);
    try {
      const data = await getBookings();
      setBookings(data);
    } catch (err) {
      console.error("Error loading bookings:", err);
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  // --- SOCKET.IO & INITIAL LOAD ---
  useEffect(() => {
    loadData();

    // Conectar WebSocket
    const socket = io(); // Se conecta automáticamente al host actual

    socket.on('connect', () => {
      console.log('Conectado al servidor de reservas en tiempo real');
    });

    socket.on('server:bookings_updated', (updatedBookings: Booking[]) => {
      console.log('Actualización en tiempo real recibida');
      setBookings(updatedBookings);
    });

    return () => {
      socket.disconnect();
    };
  }, []); 

  // --- FILTER LOGIC ---
  const filteredBookings = useMemo(() => {
    if (!teacherFilter && !courseFilter) return bookings;
    
    return bookings.filter(b => {
        const matchTeacher = !teacherFilter || b.teacherName.toLowerCase().includes(teacherFilter.toLowerCase());
        const matchCourse = !courseFilter || b.course?.toLowerCase().includes(courseFilter.toLowerCase());
        return matchTeacher && matchCourse;
    });
  }, [bookings, teacherFilter, courseFilter]);

  const handlePrevWeek = () => setCurrentDate(subWeeks(currentDate, 1));
  const handleNextWeek = () => setCurrentDate(addWeeks(currentDate, 1));
  const handleDateJump = (e: React.ChangeEvent<HTMLInputElement>) => {
      if(e.target.value) setCurrentDate(parseISO(e.target.value));
  };

  const weekDays = getWeekDays(currentDate);

  const getBookingForSlot = (day: Date, slotId: string) => {
    const dateStr = formatDate(day);
    // Usamos filteredBookings para la visualización. 
    // Si hay un filtro activo, los slots que no coincidan parecerán vacíos (intencional para "búsqueda").
    // Sin embargo, para evitar reservas dobles por error visual, si hay filtros activos y el slot está "vacío" pero realmente ocupado,
    // deberíamos manejarlo. Aquí, simplemente mostramos lo que coincide con el filtro.
    return filteredBookings.find(b => b.date === dateStr && b.slotId === slotId && b.stage === stage);
  };

  const handleSlotClick = (day: Date, slot: TimeSlot) => {
    if (!isBookableDay(day)) return;
    
    // Al hacer clic, comprobamos contra TODOS los bookings, no solo los filtrados, para evitar conflictos
    const realDateStr = formatDate(day);
    const existing = bookings.find(b => b.date === realDateStr && b.slotId === slot.id && b.stage === stage);
    
    setExistingBooking(existing || null);
    setSelectedSlot({ date: day, slot });

    // Initialize Form State
    setCourse(existing?.course || courses[0]);
    setSubject(existing?.subject || '');
    setTeacherName(existing?.teacherName || user.name);
    setBlockReason(existing?.justification || '');
    setIsBlocking(existing?.isBlocked || false);
    setIsRecurring(false);
    setRecurringEndDate('');
    
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
     if (!existingBooking) return;
     if (confirm('¿Eliminar esta reserva permanentemente?')) {
        setIsSubmitting(true);
        try {
          // Actualización: Se pasa el usuario actual para registrar quién elimina
          await removeBooking(existingBooking.id, user);
          setIsSubmitting(false);
          setIsModalOpen(false);
          // loadData se llamará automáticamente vía socket
        } catch (e) {
          alert("Error al eliminar.");
          setIsSubmitting(false);
        }
     }
  };

  const handleSaveBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot || existingBooking) return;

    setIsSubmitting(true);

    const baseBooking = {
      slotId: selectedSlot.slot.id,
      stage,
      teacherEmail: user.email,
      teacherName: isBlocking ? 'ADMINISTRADOR' : teacherName,
      course: isBlocking ? undefined : course,
      subject: isBlocking ? undefined : subject,
      isBlocked: isBlocking,
      justification: isBlocking ? blockReason : undefined,
      createdAt: Date.now(),
      logs: [{
          action: isBlocking ? 'BLOCKED' : 'CREATED',
          user: user.email,
          userName: user.name,
          timestamp: Date.now(),
          details: isBlocking ? blockReason : `${course} - ${subject}`
      }] as any[]
    };

    try {
      if (isRecurring && user.role === Role.ADMIN && recurringEndDate) {
          const bookingsToCreate: Booking[] = [];
          let loopDate = selectedSlot.date;
          const end = new Date(recurringEndDate);
          
          while (loopDate <= end) {
              if (isBookableDay(loopDate)) {
                 bookingsToCreate.push({
                     ...baseBooking,
                     id: crypto.randomUUID(),
                     date: formatDate(loopDate)
                 });
              }
              loopDate = addWeeks(loopDate, 1);
          }
          if (bookingsToCreate.length > 0) await saveBatchBookings(bookingsToCreate);
      } else {
          const newBooking: Booking = {
            ...baseBooking,
            id: crypto.randomUUID(),
            date: formatDate(selectedSlot.date),
          };
          await saveBooking(newBooking);
      }
      setIsSubmitting(false);
      setIsModalOpen(false);
      // loadData(); // Ya no es necesario forzarlo, el socket lo hará
    } catch (e: any) {
      setIsSubmitting(false);
      if (e.message === 'CONFLICT') {
        alert("⚠️ ¡Ups! Alguien acaba de reservar este hueco hace un instante. La página se actualizará.");
        setIsModalOpen(false);
        loadData(); // Forzar recarga inmediata
      } else {
        alert("Error de conexión al guardar.");
      }
    }
  };

  if (error && bookings.length === 0) {
     return (
        <div className="h-[calc(100vh-100px)] flex flex-col items-center justify-center p-4 animate-fade-in text-center">
            <div className="bg-red-50 p-8 rounded-full mb-6 border border-red-100 shadow-xl shadow-red-500/10">
                <WifiOff className="w-12 h-12 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Conexión interrumpida</h2>
            <button onClick={loadData} className="mt-6 flex items-center px-8 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl hover:-translate-y-1">
               <RefreshCw className={`w-5 h-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
               {loading ? 'Reintentando...' : 'Reintentar Conexión'}
            </button>
        </div>
     );
  }

  return (
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in flex flex-col h-[calc(100vh-80px)]">
      
      {/* --- HEADER CONTROLS --- */}
      <div className="flex-none flex flex-col gap-4 mb-6">
          <div className="flex flex-col md:flex-row justify-between items-center glass-panel p-4 rounded-3xl gap-4">
            <div className="flex items-center space-x-4 w-full md:w-auto">
              <button onClick={onBack} className="p-3 hover:bg-slate-100 rounded-2xl transition-all text-slate-500 border border-transparent hover:border-slate-200">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h2 className={`text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r ${colors.gradient}`}>{roomName}</h2>
                <div className="flex items-center text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">
                    <span className={`w-2 h-2 rounded-full bg-${colors.primary}-500 mr-2`}></span>
                    {stage}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                {/* Admin Tools Toggle */}
                {user.role === Role.ADMIN && (
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setIsHistoryOpen(true)}
                            className="p-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors"
                            title="Ver Historial"
                        >
                            <History className="h-5 w-5" />
                        </button>
                        <button 
                            onClick={() => setShowFilters(!showFilters)}
                            className={`p-3 rounded-xl transition-colors flex items-center gap-2 ${showFilters ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        >
                            <Filter className="h-5 w-5" />
                            <span className="hidden sm:inline text-sm font-bold">Filtros</span>
                        </button>
                    </div>
                )}
                
                {/* Date Navigation */}
                <div className="flex items-center space-x-4 bg-slate-50/50 p-1.5 rounded-2xl border border-slate-200/60">
                    <button onClick={handlePrevWeek} className="p-2.5 hover:bg-white rounded-xl transition-all text-slate-600 shadow-sm hover:shadow-md">
                    <ChevronLeft className="h-4 w-4" />
                    </button>
                    <div className="px-6 flex flex-col items-center justify-center min-w-[140px] cursor-pointer relative group">
                        <span className="text-sm font-bold text-slate-800 capitalize">{format(weekDays[0], 'MMMM', { locale: es })}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{format(weekDays[0], 'yyyy')}</span>
                        {/* Hidden date input overlay for quick jump */}
                        <input 
                            type="date" 
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            onChange={handleDateJump}
                        />
                    </div>
                    <button onClick={handleNextWeek} className="p-2.5 hover:bg-white rounded-xl transition-all text-slate-600 shadow-sm hover:shadow-md">
                    <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
            </div>
          </div>

          {/* --- ADMIN FILTER BAR --- */}
          {user.role === Role.ADMIN && showFilters && (
             <div className="glass-panel p-4 rounded-2xl animate-slide-up flex flex-col md:flex-row gap-4 items-center">
                 <div className="relative flex-1 w-full">
                     <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                     <input 
                        type="text" 
                        placeholder="Filtrar por profesor..."
                        value={teacherFilter}
                        onChange={(e) => setTeacherFilter(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-200"
                     />
                     {teacherFilter && <button onClick={() => setTeacherFilter('')} className="absolute right-3 top-3"><XCircle className="w-4 h-4 text-slate-400 hover:text-slate-600"/></button>}
                 </div>
                 <div className="relative flex-1 w-full">
                     <Book className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                     <select 
                        value={courseFilter}
                        onChange={(e) => setCourseFilter(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-200 appearance-none"
                     >
                        <option value="">Todos los cursos</option>
                        {courses.map(c => <option key={c} value={c}>{c}</option>)}
                     </select>
                 </div>
                 <div className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2">
                     {filteredBookings.length} reservas visibles
                 </div>
             </div>
          )}
      </div>

      {/* --- CALENDAR GRID --- */}
      <div className="flex-1 glass-panel rounded-[2.5rem] overflow-hidden shadow-2xl shadow-slate-200/50 flex flex-col relative border-0">
        <div className="overflow-auto flex-1 custom-scrollbar">
            <div className="min-w-[900px] relative">
              
              {/* Header Days */}
              <div className="grid grid-cols-[100px_repeat(5,1fr)] sticky top-0 z-20">
                <div className="sticky left-0 top-0 z-30 glass-header p-5 flex items-center justify-center text-[10px] font-bold text-slate-400 uppercase tracking-widest border-r border-slate-100">
                   Horario
                </div>
                {weekDays.slice(0, 5).map((day) => {
                   const isToday = isSameDay(day, new Date());
                   return (
                    <div key={day.toISOString()} className={`p-4 text-center glass-header border-r border-slate-100/50 last:border-r-0 ${isToday ? 'bg-blue-50/30' : ''}`}>
                      <div className={`text-2xl font-black ${isToday ? colors.text : 'text-slate-800'}`}>
                          {format(day, 'd')}
                      </div>
                      <div className={`text-xs font-bold uppercase tracking-widest ${isToday ? colors.text : 'text-slate-400'}`}>
                          {format(day, 'EEE', { locale: es })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Rows */}
              {slots.map((slot, idx) => (
                <div key={slot.id} className={`grid grid-cols-[100px_repeat(5,1fr)] group ${idx % 2 === 0 ? 'bg-white/40' : 'bg-white/10'}`}>
                  
                  {/* Time Column */}
                  <div className="sticky left-0 z-10 glass-header border-r border-slate-100 p-4 flex flex-col items-center justify-center text-xs font-bold text-slate-500 group-hover:bg-slate-50/80 transition-colors">
                    <span>{slot.start}</span>
                    <div className="h-8 w-[1px] bg-slate-200 my-1"></div>
                    <span className="text-slate-400">{slot.end}</span>
                  </div>
                  
                  {/* Slot Cells */}
                  {weekDays.slice(0, 5).map((day) => {
                    // Aquí usamos la función que consulta filteredBookings
                    const booking = getBookingForSlot(day, slot.id);
                    const isHoliday = !isBookableDay(day);
                    
                    if (isHoliday) {
                      return (
                        <div key={`${day}-${slot.id}`} className="min-h-[160px] p-2 border-r border-slate-100/30 bg-slate-50/50 flex items-center justify-center">
                           <div className="bg-slate-100 text-slate-300 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transform -rotate-6">No Lectivo</div>
                        </div>
                      );
                    }

                    if (booking) {
                        const isMyBooking = booking.teacherEmail === user.email;
                        const cardStyle = booking.isBlocked 
                            ? "bg-slate-800 text-slate-300 border-slate-700" 
                            : isMyBooking 
                                ? `${colors.bg} ${colors.text} border-${colors.primary}-200` 
                                : "bg-white text-slate-600 border-slate-200";

                        return (
                           <div key={`${day}-${slot.id}`} className="min-h-[160px] p-3 border-r border-slate-100/50 relative group/cell" onClick={() => handleSlotClick(day, slot)}>
                              <div className={`h-full w-full rounded-2xl p-4 border ${cardStyle} shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden`}>
                                  
                                  {/* Decorative bar */}
                                  <div className={`absolute top-0 left-0 w-full h-1 ${booking.isBlocked ? 'bg-red-500' : (isMyBooking ? `bg-${colors.primary}-500` : 'bg-amber-400')}`}></div>

                                  <div>
                                      {booking.isBlocked ? (
                                          <div className="flex items-center gap-2 mb-2">
                                              <Lock className="w-3 h-3 text-red-400" />
                                              <span className="text-[10px] font-bold uppercase tracking-wider text-red-400">Bloqueado</span>
                                          </div>
                                      ) : (
                                          <div className="font-extrabold text-sm leading-tight mb-1 line-clamp-2">
                                              {booking.course}
                                          </div>
                                      )}
                                      
                                      <div className={`text-xs font-medium leading-snug ${booking.isBlocked ? 'text-slate-400' : 'opacity-80'}`}>
                                          {booking.isBlocked ? booking.justification : booking.subject}
                                      </div>
                                  </div>

                                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-black/5">
                                      <div className="flex items-center gap-1.5">
                                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${booking.isBlocked ? 'bg-slate-700 text-white' : 'bg-white shadow-sm'}`}>
                                              {booking.teacherName.charAt(0)}
                                          </div>
                                          <span className="text-[10px] font-bold truncate max-w-[60px] opacity-70">
                                              {booking.teacherName.split(' ')[0]}
                                          </span>
                                      </div>
                                      {isMyBooking && <div className={`w-1.5 h-1.5 rounded-full bg-${colors.primary}-500`}></div>}
                                  </div>
                              </div>
                           </div>
                        );
                    }

                    return (
                        <div key={`${day}-${slot.id}`} 
                             className="min-h-[160px] p-3 border-r border-slate-100/50 relative group/cell cursor-pointer"
                             onClick={() => handleSlotClick(day, slot)}>
                             <div className="h-full w-full rounded-2xl border border-dashed border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all flex items-center justify-center opacity-0 group-hover/cell:opacity-100 scale-95 group-hover/cell:scale-100">
                                 <div className="flex flex-col items-center">
                                     <div className={`h-8 w-8 rounded-full ${colors.bg} flex items-center justify-center text-${colors.primary}-600 mb-2`}>
                                         <span className="text-xl leading-none font-light">+</span>
                                     </div>
                                     <span className="text-xs font-bold text-slate-400">Reservar</span>
                                 </div>
                             </div>
                        </div>
                    );
                  })}
                </div>
              ))}
            </div>
        </div>
      </div>

      {/* --- HISTORY MODAL --- */}
      <HistoryModal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} />

      {/* --- BOOKING MODAL --- */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={existingBooking 
            ? (existingBooking.isBlocked ? 'Bloqueo Administrativo' : 'Detalles de Reserva') 
            : `Nueva Reserva`
        }
      >
        <div className="animate-scale-in">
        {existingBooking ? (
            <div className="space-y-6">
                <div className={`p-6 rounded-2xl border ${existingBooking.isBlocked ? 'bg-slate-50 border-slate-200' : `bg-white border-${colors.primary}-100 shadow-lg shadow-${colors.primary}-500/5`}`}>
                    <div className="grid grid-cols-2 gap-6">
                        <div className="col-span-2 flex items-center gap-3 pb-4 border-b border-slate-100">
                           <div className={`h-10 w-10 rounded-full flex items-center justify-center ${existingBooking.isBlocked ? 'bg-red-100 text-red-600' : `bg-${colors.primary}-100 ${colors.text}`}`}>
                              {existingBooking.isBlocked ? <Lock className="w-5 h-5" /> : <Book className="w-5 h-5" />}
                           </div>
                           <div>
                               <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Estado</p>
                               <p className={`text-sm font-bold ${existingBooking.isBlocked ? 'text-red-600' : colors.text}`}>
                                   {existingBooking.isBlocked ? 'Espacio Bloqueado' : 'Reserva Confirmada'}
                               </p>
                           </div>
                        </div>

                        <div>
                             <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Profesor</span>
                             <div className="mt-1 flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">{existingBooking.teacherName.charAt(0)}</div>
                                <span className="text-sm font-bold text-slate-800">{existingBooking.teacherName}</span>
                             </div>
                        </div>

                        {!existingBooking.isBlocked && (
                            <div className="col-span-2">
                                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Detalles Académicos</span>
                                <div className="mt-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <div className="text-base font-extrabold text-slate-900">{existingBooking.course}</div>
                                    <div className="text-sm text-slate-600 font-medium">{existingBooking.subject}</div>
                                </div>
                            </div>
                        )}
                        {existingBooking.isBlocked && (
                            <div className="col-span-2">
                                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Motivo</span>
                                <div className="mt-2 p-4 bg-white rounded-xl border border-slate-200 text-sm font-medium text-slate-700 italic">"{existingBooking.justification}"</div>
                            </div>
                        )}
                    </div>
                </div>

                {user.role === Role.ADMIN && (
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center">
                            <History className="w-3 h-3 mr-2" /> Historial de Cambios
                        </h4>
                        <div className="space-y-3">
                            {existingBooking.logs?.map((log, idx) => (
                                <div key={idx} className="flex text-xs items-center gap-3">
                                    <span className="font-mono text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-100">
                                        {format(new Date(log.timestamp), 'dd/MM HH:mm')}
                                    </span>
                                    <div>
                                        <span className={`font-bold ${log.action === 'BLOCKED' ? 'text-red-600' : 'text-blue-600'}`}>
                                            {log.action === 'CREATED' ? 'Creado' : 'Bloqueado'}
                                        </span>
                                        <span className="text-slate-500 px-1">por</span>
                                        <span className="font-bold text-slate-700">{log.userName}</span>
                                    </div>
                                </div>
                            )) || <div className="text-xs text-slate-400 italic">Sin historial.</div>}
                        </div>
                    </div>
                )}

                {(user.role === Role.ADMIN || existingBooking.teacherEmail === user.email) && (
                     <div className="pt-2 flex justify-end">
                        <button
                            onClick={handleDelete}
                            disabled={isSubmitting}
                            className="flex items-center px-5 py-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors text-sm font-bold border border-red-200 shadow-sm"
                        >
                            <Trash2 className="w-4 h-4 mr-2" />
                            {isSubmitting ? 'Procesando...' : 'Eliminar Reserva'}
                        </button>
                    </div>
                )}
            </div>
        ) : (
            <form onSubmit={handleSaveBooking} className="space-y-6">
            {user.role === Role.ADMIN && (
                <div className="grid grid-cols-2 gap-4">
                    <div 
                        className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col gap-2 ${isBlocking ? 'bg-slate-800 border-slate-900 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`} 
                        onClick={() => setIsBlocking(!isBlocking)}
                    >
                        <div className="flex justify-between items-center">
                            <Lock className={`w-5 h-5 ${isBlocking ? 'text-red-400' : 'text-slate-400'}`} />
                            {isBlocking && <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse"></div>}
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider mt-auto">Modo Bloqueo</span>
                    </div>

                    <div 
                        className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col gap-2 ${isRecurring ? 'bg-blue-600 border-blue-700 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`} 
                        onClick={() => setIsRecurring(!isRecurring)}
                    >
                        <div className="flex justify-between items-center">
                            <Repeat className={`w-5 h-5 ${isRecurring ? 'text-white' : 'text-slate-400'}`} />
                            {isRecurring && <div className="h-2 w-2 bg-white rounded-full"></div>}
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider mt-auto">Repetir Semanal</span>
                    </div>
                    
                    {isRecurring && (
                        <div className="col-span-2 p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-center gap-3 animate-fade-in">
                            <CalendarDays className="w-5 h-5 text-blue-500" />
                            <div className="flex-1">
                                <label className="text-[10px] font-bold text-blue-500 uppercase tracking-wider block mb-1">Repetir hasta</label>
                                <input 
                                    type="date"
                                    required
                                    min={formatDate(selectedSlot?.date || new Date())}
                                    value={recurringEndDate}
                                    onChange={(e) => setRecurringEndDate(e.target.value)}
                                    className="bg-white border border-blue-200 text-blue-900 text-sm rounded-lg block w-full p-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                        </div>
                    )}
                </div>
            )}

            {!isBlocking ? (
                <div className="space-y-5">
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Profesor Responsable</label>
                        <div className="flex items-center px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl">
                            <UserIcon className="h-5 w-5 text-slate-400 mr-3" />
                            <input
                                type="text"
                                required
                                value={teacherName}
                                onChange={(e) => setTeacherName(e.target.value)}
                                className="flex-1 bg-transparent border-none p-0 text-sm font-bold text-slate-800 focus:ring-0 placeholder-slate-400"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Curso</label>
                        <div className="relative">
                            <select
                                value={course}
                                onChange={(e) => setCourse(e.target.value)}
                                className="block w-full px-4 py-3 text-sm font-bold text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none"
                            >
                                {courses.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <MoreHorizontal className="absolute right-4 top-3.5 h-5 w-5 text-slate-400 pointer-events-none" />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Asignatura</label>
                        <div className="flex items-center px-4 py-3 bg-white border border-slate-200 rounded-xl focus-within:ring-2 focus-within:ring-brand-500/20 focus-within:border-brand-500 transition-all">
                            <Book className="h-5 w-5 text-slate-400 mr-3" />
                            <input
                                type="text"
                                required
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                placeholder="Ej: Matemáticas, Taller..."
                                className="flex-1 bg-transparent border-none p-0 text-sm font-bold text-slate-800 focus:ring-0 placeholder-slate-400"
                            />
                        </div>
                    </div>
                </div>
            ) : (
                <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Motivo del bloqueo</label>
                    <textarea
                        required
                        value={blockReason}
                        onChange={(e) => setBlockReason(e.target.value)}
                        placeholder="Describe la razón..."
                        rows={3}
                        className="block w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                    />
                </div>
            )}

            <div className="flex justify-end pt-2 gap-3">
                <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                >
                Cancelar
                </button>
                <button
                type="submit"
                disabled={isSubmitting}
                className={`flex items-center justify-center px-8 py-3 rounded-xl text-sm font-bold text-white shadow-lg transition-all transform hover:-translate-y-0.5 ${isBlocking ? 'bg-slate-900 hover:bg-slate-800' : 'bg-brand-600 hover:bg-brand-700'}`}
                >
                {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : (isBlocking ? 'Bloquear' : 'Confirmar')}
                </button>
            </div>
            </form>
        )}
        </div>
      </Modal>
    </div>
  );
};