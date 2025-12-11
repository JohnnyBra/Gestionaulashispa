import React, { useState, useEffect } from 'react';
import { Stage, User, TimeSlot, Booking, SLOTS_PRIMARY, SLOTS_SECONDARY, COURSES_PRIMARY, COURSES_SECONDARY, Role } from '../types';
import { getBookings, saveBooking, removeBooking } from '../services/storageService';
import { formatDate, getWeekDays, isBookableDay } from '../utils/dateUtils';
import { Modal } from '../components/Modal';
import { ChevronLeft, ChevronRight, Lock, User as UserIcon, Book, ArrowLeft, Trash2, Loader2, Clock, History, AlertTriangle, Calendar as CalendarIcon } from 'lucide-react';
import { addWeeks, subWeeks, format, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';

interface CalendarViewProps {
  stage: Stage;
  user: User;
  onBack: () => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ stage, user, onBack }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ date: Date, slot: TimeSlot } | null>(null);
  const [existingBooking, setExistingBooking] = useState<Booking | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form State
  const [course, setCourse] = useState('');
  const [subject, setSubject] = useState('');
  const [teacherName, setTeacherName] = useState(user.name);
  const [blockReason, setBlockReason] = useState('');
  const [isBlocking, setIsBlocking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const slots = stage === Stage.PRIMARY ? SLOTS_PRIMARY : SLOTS_SECONDARY;
  const courses = stage === Stage.PRIMARY ? COURSES_PRIMARY : COURSES_SECONDARY;
  const roomName = stage === Stage.PRIMARY ? 'Aula de Idiomas' : 'Aula de Informática';
  const themeColor = stage === Stage.PRIMARY ? 'blue' : 'emerald';
  const themeClasses = stage === Stage.PRIMARY ? 'from-blue-600 to-blue-500' : 'from-emerald-600 to-emerald-500';

  const loadData = async () => {
    setLoading(true);
    const data = await getBookings();
    setBookings(data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [isModalOpen]); 

  useEffect(() => {
    const interval = setInterval(loadData, 30000); 
    return () => clearInterval(interval);
  }, []);

  const handlePrevWeek = () => setCurrentDate(subWeeks(currentDate, 1));
  const handleNextWeek = () => setCurrentDate(addWeeks(currentDate, 1));

  const weekDays = getWeekDays(currentDate);

  const getBookingForSlot = (day: Date, slotId: string) => {
    const dateStr = formatDate(day);
    return bookings.find(b => b.date === dateStr && b.slotId === slotId && b.stage === stage);
  };

  const handleSlotClick = (day: Date, slot: TimeSlot) => {
    if (!isBookableDay(day)) return;
    
    const existing = getBookingForSlot(day, slot.id);
    setExistingBooking(existing || null);
    setSelectedSlot({ date: day, slot });

    // Initialize Form State
    setCourse(existing?.course || courses[0]);
    setSubject(existing?.subject || '');
    setTeacherName(existing?.teacherName || user.name);
    setBlockReason(existing?.justification || '');
    setIsBlocking(existing?.isBlocked || false);
    
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
     if (!existingBooking) return;
     
     if (confirm('¿Estás seguro de que quieres eliminar esta reserva?')) {
        setIsSubmitting(true);
        await removeBooking(existingBooking.id);
        setIsSubmitting(false);
        setIsModalOpen(false);
        await loadData();
     }
  };

  const handleSaveBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot || existingBooking) return;

    setIsSubmitting(true);

    const newBooking: Booking = {
      id: crypto.randomUUID(),
      date: formatDate(selectedSlot.date),
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
      }]
    };

    await saveBooking(newBooking);
    setIsSubmitting(false);
    setIsModalOpen(false);
    await loadData(); 
  };

  return (
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in h-screen flex flex-col">
      {/* Header */}
      <div className="flex-none flex flex-col md:flex-row justify-between items-center mb-6 bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center space-x-4 mb-4 md:mb-0 w-full md:w-auto">
          <button onClick={onBack} className="p-2.5 hover:bg-slate-100 rounded-xl transition-colors text-slate-600 border border-slate-200 hover:border-slate-300">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h2 className={`text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r ${themeClasses}`}>{roomName}</h2>
            <div className="flex items-center text-xs text-slate-500 font-semibold mt-0.5">
                <span className={`w-2 h-2 rounded-full bg-${themeColor}-500 mr-2`}></span>
                {stage}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {loading && <Loader2 className="animate-spin text-primary-500 h-5 w-5" />}
          
          <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
            <button onClick={handlePrevWeek} className="p-2 hover:bg-slate-50 rounded-lg transition-all text-slate-600">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-4 font-semibold text-slate-700 min-w-[160px] text-center flex items-center justify-center text-sm">
              <CalendarIcon className="w-4 h-4 mr-2 text-slate-400" />
              {formatDate(weekDays[0])}
            </span>
            <button onClick={handleNextWeek} className="p-2 hover:bg-slate-50 rounded-lg transition-all text-slate-600">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Grid Container with Sticky Headers */}
      <div className="flex-1 bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200 relative flex flex-col">
        <div className="overflow-auto flex-1 custom-scrollbar">
            <div className="min-w-[800px] relative">
              
              {/* Table Header (Days) - Sticky Top */}
              <div className="grid grid-cols-[100px_repeat(5,1fr)] sticky top-0 z-20 shadow-sm">
                {/* Top-Left Corner - Sticky Both */}
                <div className="sticky left-0 top-0 z-30 bg-slate-50 border-b border-r border-slate-200 p-4 flex items-center justify-center text-xs font-bold text-slate-400 uppercase tracking-widest">
                   <Clock className="w-4 h-4 mr-1.5" /> Hora
                </div>
                
                {/* Days Columns */}
                {weekDays.slice(0, 5).map((day) => {
                   const isToday = isSameDay(day, new Date());
                   return (
                    <div key={day.toISOString()} className={`p-3 text-center border-b border-r border-slate-100 last:border-r-0 bg-slate-50/95 backdrop-blur-sm ${!isBookableDay(day) ? 'bg-red-50/50' : ''}`}>
                      <div className={`font-extrabold text-base capitalize ${isToday ? `text-${themeColor}-600` : 'text-slate-800'}`}>
                          {format(day, 'EEEE', { locale: es })}
                      </div>
                      <div className={`text-xs font-medium ${isToday ? `text-${themeColor}-600` : 'text-slate-500'}`}>
                          {format(day, 'd MMM', { locale: es })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Slots Rows */}
              {slots.map((slot) => (
                <div key={slot.id} className="grid grid-cols-[100px_repeat(5,1fr)] group">
                  
                  {/* Time Label - Sticky Left */}
                  <div className="sticky left-0 z-10 bg-slate-50/95 backdrop-blur-sm p-4 flex flex-col items-center justify-center border-b border-r border-slate-200 text-xs font-semibold text-slate-500 group-hover:bg-slate-100/90 transition-colors">
                    <span>{slot.start}</span>
                    <span className="h-4 w-[1px] bg-slate-300 my-1"></span>
                    <span>{slot.end}</span>
                  </div>
                  
                  {/* Booking Cells */}
                  {weekDays.slice(0, 5).map((day) => {
                    const booking = getBookingForSlot(day, slot.id);
                    const isHoliday = !isBookableDay(day);
                    
                    let cellClasses = "min-h-[140px] p-2 border-b border-r border-slate-100 relative transition-all duration-200 last:border-r-0 ";
                    let content;

                    if (isHoliday) {
                      cellClasses += "bg-red-50/30";
                      content = (
                        <div className="h-full w-full flex items-center justify-center opacity-50">
                            <span className="text-xs text-red-400 font-bold uppercase tracking-widest rotate-[-15deg] border-2 border-red-200 px-2 py-1 rounded">No Lectivo</span>
                        </div>
                      );
                    } else if (booking) {
                      cellClasses += "cursor-pointer hover:brightness-95 ";
                      
                      if (booking.isBlocked) {
                        cellClasses += "bg-white"; // Wrapper
                        content = (
                          <div className="h-full w-full rounded-lg bg-slate-800 text-white p-3 shadow-md flex flex-col justify-center relative overflow-hidden group/card border border-slate-700">
                             <div className="absolute top-0 right-0 p-1.5 opacity-50 group-hover/card:opacity-100 transition-opacity">
                                <Lock className="w-4 h-4" />
                             </div>
                             <div className="text-center z-10">
                                <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1 block">Bloqueado</span>
                                <span className="text-sm font-bold text-white line-clamp-3 leading-snug">{booking.justification}</span>
                             </div>
                          </div>
                        );
                      } else {
                        const isMyBooking = booking.teacherEmail === user.email;
                        
                        // HIGH CONTRAST STYLING
                        // Using white background for all cards to ensure text readability
                        // Using thick colored borders to distinguish ownership/status
                        const borderColor = isMyBooking ? `border-${themeColor}-600` : "border-amber-500";
                        const topBarColor = isMyBooking ? `bg-${themeColor}-600` : "bg-amber-500";
                        const iconColor = isMyBooking ? `text-${themeColor}-700` : "text-amber-700";
                        
                        content = (
                          <div className={`h-full w-full rounded-lg bg-white border border-slate-200 shadow-sm hover:shadow-lg transition-all flex flex-col overflow-hidden group/card`}>
                             {/* Top Color Bar */}
                             <div className={`h-1.5 w-full ${topBarColor}`}></div>
                             
                             <div className="p-3 flex-1 flex flex-col">
                                 <div className="font-extrabold text-sm text-slate-900 leading-tight mb-1">{booking.course}</div>
                                 <div className="text-xs text-slate-600 font-medium leading-tight line-clamp-2 mb-auto">{booking.subject}</div>
                                 
                                 <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                                   <div className="flex items-center text-xs font-bold text-slate-500">
                                     <UserIcon className="w-3 h-3 mr-1.5 opacity-60" />
                                     <span className="truncate max-w-[90px] text-slate-700">{booking.teacherName.split(' ')[0]}</span>
                                   </div>
                                   {isMyBooking && (
                                     <div className={`px-1.5 py-0.5 rounded text-[10px] font-bold bg-${themeColor}-100 text-${themeColor}-800`}>MÍO</div>
                                   )}
                                 </div>
                             </div>
                          </div>
                        );
                      }
                    } else {
                      cellClasses += "hover:bg-slate-50 cursor-pointer group/cell";
                      content = (
                          <div className="h-full w-full flex items-center justify-center opacity-0 group-hover/cell:opacity-100 transition-opacity duration-200">
                              <div className={`flex flex-col items-center text-${themeColor}-600 bg-white px-3 py-2 rounded-lg border-2 border-${themeColor}-200 shadow-sm`}>
                                  <span className="font-bold text-xs">+ Reservar</span>
                              </div>
                          </div>
                      );
                    }

                    return (
                      <div 
                        key={`${day.toISOString()}-${slot.id}`} 
                        className={cellClasses}
                        onClick={() => handleSlotClick(day, slot)}
                      >
                        {content}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
        </div>
      </div>

      {/* Modal Reused from previous implementation */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={existingBooking 
            ? (existingBooking.isBlocked ? 'Detalles del Bloqueo' : 'Detalles de la Reserva') 
            : `Nueva Reserva`
        }
      >
        {existingBooking ? (
            <div className="space-y-6">
                <div className={`p-5 rounded-xl ${existingBooking.isBlocked ? 'bg-slate-100 border border-slate-200' : `bg-white border border-${themeColor}-200 shadow-sm`}`}>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <span className="text-xs text-slate-500 uppercase tracking-wider font-bold">Estado</span>
                            <div className="mt-1 font-semibold flex items-center text-sm">
                                {existingBooking.isBlocked ? (
                                    <><Lock className="w-4 h-4 mr-2 text-red-600" /> <span className="text-red-700 font-bold">Bloqueado</span></>
                                ) : (
                                    <><Book className={`w-4 h-4 mr-2 text-${themeColor}-600`} /> <span className={`text-${themeColor}-700 font-bold`}>Reservado</span></>
                                )}
                            </div>
                        </div>
                        <div>
                             <span className="text-xs text-slate-500 uppercase tracking-wider font-bold">Responsable</span>
                             <div className="mt-1 text-sm font-bold text-slate-800">{existingBooking.teacherName}</div>
                        </div>
                        {!existingBooking.isBlocked && (
                            <>
                                <div className="col-span-2 pt-2">
                                    <span className="text-xs text-slate-500 uppercase tracking-wider font-bold">Asignatura/Curso</span>
                                    <div className="mt-1 text-lg font-extrabold text-slate-900">{existingBooking.course}</div>
                                    <div className="text-base text-slate-700 font-medium">{existingBooking.subject}</div>
                                </div>
                            </>
                        )}
                        {existingBooking.isBlocked && (
                            <div className="col-span-2 pt-2">
                                <span className="text-xs text-slate-500 uppercase tracking-wider font-bold">Motivo</span>
                                <div className="mt-1 p-3 bg-white rounded-lg border border-slate-300 text-sm font-medium text-slate-700">{existingBooking.justification}</div>
                            </div>
                        )}
                    </div>
                </div>

                {user.role === Role.ADMIN && (
                    <div className="border-t border-slate-100 pt-4">
                        <h4 className="text-sm font-bold text-slate-700 flex items-center mb-3">
                            <History className="w-4 h-4 mr-2" /> Historial
                        </h4>
                        <div className="space-y-3 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                            {existingBooking.logs?.map((log, idx) => (
                                <div key={idx} className="flex text-xs items-start">
                                    <div className="min-w-[70px] text-slate-400 font-mono">
                                        {format(new Date(log.timestamp), 'dd/MM HH:mm')}
                                    </div>
                                    <div className="ml-2">
                                        <span className={`font-bold ${log.action === 'BLOCKED' ? 'text-red-600' : 'text-blue-600'}`}>
                                            {log.action === 'CREATED' ? 'Creado' : 'Bloqueado'}
                                        </span>
                                        <span className="text-slate-500"> por </span>
                                        <span className="font-bold text-slate-700">{log.userName}</span>
                                    </div>
                                </div>
                            )) || <div className="text-xs text-slate-400 italic">Sin historial.</div>}
                        </div>
                    </div>
                )}

                {(user.role === Role.ADMIN || existingBooking.teacherEmail === user.email) && (
                     <div className="pt-4 flex justify-end">
                        <button
                            onClick={handleDelete}
                            disabled={isSubmitting}
                            className="flex items-center px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm font-bold border border-red-200"
                        >
                            <Trash2 className="w-4 h-4 mr-2" />
                            {isSubmitting ? 'Eliminando...' : 'Eliminar Reserva'}
                        </button>
                    </div>
                )}
            </div>
        ) : (
            <form onSubmit={handleSaveBooking} className="space-y-5">
            {user.role === Role.ADMIN && (
                <div className="flex items-center p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => setIsBlocking(!isBlocking)}>
                <div className={`w-5 h-5 rounded border flex items-center justify-center mr-3 ${isBlocking ? 'bg-slate-800 border-slate-800' : 'bg-white border-slate-300'}`}>
                    {isBlocking && <Lock className="w-3 h-3 text-white" />}
                </div>
                <div className="flex-1">
                    <span className="block text-sm font-bold text-slate-800">Modo Bloqueo Administrativo</span>
                    <span className="text-xs text-slate-500">Impide que otros profesores reserven este tramo.</span>
                </div>
                </div>
            )}

            {!isBlocking ? (
                <div className="space-y-4 animate-scale-in">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Profesor/a</label>
                    <div className="flex rounded-lg shadow-sm">
                    <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-slate-300 bg-slate-50 text-slate-500">
                        <UserIcon className="h-4 w-4" />
                    </span>
                    <input
                        type="text"
                        required
                        value={teacherName}
                        onChange={(e) => setTeacherName(e.target.value)}
                        className="flex-1 block w-full px-3 py-2.5 rounded-r-lg border border-slate-300 focus:ring-primary-500 focus:border-primary-500 text-sm font-medium text-slate-900"
                    />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Curso</label>
                    <select
                    value={course}
                    onChange={(e) => setCourse(e.target.value)}
                    className="block w-full px-3 py-2.5 text-sm border border-slate-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 rounded-lg bg-white font-medium text-slate-900"
                    >
                    {courses.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Asignatura</label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Book className="h-4 w-4 text-slate-400" />
                        </div>
                        <input
                            type="text"
                            required
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            placeholder="Ej: Matemáticas, Taller..."
                            className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 text-sm font-medium text-slate-900"
                        />
                    </div>
                </div>
                </div>
            ) : (
                <div className="animate-scale-in">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Motivo del bloqueo</label>
                <div className="relative">
                    <textarea
                        required
                        value={blockReason}
                        onChange={(e) => setBlockReason(e.target.value)}
                        placeholder="Ej: Mantenimiento de equipos, Reunión de evaluación..."
                        rows={4}
                        className="block w-full p-3 border border-slate-300 rounded-lg focus:ring-slate-500 focus:border-slate-500 text-sm font-medium"
                    />
                    <div className="absolute top-3 right-3">
                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                    </div>
                </div>
                </div>
            )}

            <div className="flex justify-end pt-4 gap-3">
                <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors"
                >
                Cancelar
                </button>
                <button
                type="submit"
                disabled={isSubmitting}
                className={`flex items-center justify-center px-6 py-2 border border-transparent text-sm font-bold rounded-lg text-white shadow-lg transition-all transform hover:-translate-y-0.5 ${isBlocking ? 'bg-slate-800 hover:bg-slate-900 shadow-slate-500/30' : 'bg-primary-600 hover:bg-primary-700 shadow-primary-500/30'} ${isSubmitting ? 'opacity-70 cursor-wait' : ''}`}
                >
                {isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : (isBlocking ? 'Bloquear Aula' : 'Confirmar Reserva')}
                </button>
            </div>
            </form>
        )}
      </Modal>
    </div>
  );
};