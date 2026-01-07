import React, { useState, useEffect, useMemo } from 'react';
import { Stage, User, TimeSlot, Booking, SLOTS_PRIMARY, SLOTS_SECONDARY, COURSES_PRIMARY, COURSES_SECONDARY, Role, ResourceType, ClassGroup } from '../types';
import { getBookings, saveBooking, saveBatchBookings, removeBooking, getTeachers, getClasses } from '../services/storageService';
import { formatDate, getWeekDays, isBookableDay } from '../utils/dateUtils';
import { Modal } from '../components/Modal';
import { HistoryModal } from '../components/HistoryModal';
import { ChevronLeft, ChevronRight, History, Filter, ArrowLeft, Loader2, Laptop, Monitor } from 'lucide-react';
import { addWeeks, subWeeks, format } from 'date-fns';
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
  const [teachers, setTeachers] = useState<{name: string, email: string}[]>([]);
  const [importedClasses, setImportedClasses] = useState<ClassGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ date: Date, slot: TimeSlot } | null>(null);
  const [existingBooking, setExistingBooking] = useState<Booking | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Resource State
  const [currentResource, setCurrentResource] = useState<ResourceType>('ROOM');

  // Admin Tools State
  const [teacherFilter, setTeacherFilter] = useState('');
  const [courseFilter, setCourseFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Form State
  const [course, setCourse] = useState('');
  const [subject, setSubject] = useState('');
  const [justification, setJustification] = useState('');
  const [selectedTeacherEmail, setSelectedTeacherEmail] = useState(user.email);
  const [blockReason, setBlockReason] = useState('');
  const [isBlocking, setIsBlocking] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringEndDate, setRecurringEndDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const slots = stage === Stage.PRIMARY ? SLOTS_PRIMARY : SLOTS_SECONDARY;
  
  // LOGICA PARA OBTENER Y FILTRAR CLASES
  const courses = useMemo(() => {
    let baseList: string[] = [];
    
    if (importedClasses.length > 0) {
        const allNames = importedClasses.map(c => c.name);
        
        if (stage === Stage.PRIMARY) {
            baseList = allNames.filter(n => n.toUpperCase().includes('PRI') || n.match(/^[1-6]º.*[A-Z]/) && !n.includes('ESO') && !n.includes('BAC'));
        } else {
            baseList = allNames.filter(n => n.toUpperCase().includes('ESO') || n.toUpperCase().includes('BAC') || n.toUpperCase().includes('SEC'));
        }

        if (baseList.length === 0) {
             baseList = stage === Stage.PRIMARY ? COURSES_PRIMARY : COURSES_SECONDARY;
        }
    } else {
        baseList = stage === Stage.PRIMARY ? COURSES_PRIMARY : COURSES_SECONDARY;
    }

    if (stage === Stage.SECONDARY && currentResource === 'CART') {
        return baseList.filter(c => c.includes('3º') || c.includes('4º'));
    }
    
    return baseList.sort();
  }, [stage, currentResource, importedClasses]);

  const roomName = stage === Stage.PRIMARY 
    ? 'Aula de Idiomas' 
    : (currentResource === 'CART' ? 'Carro de Portátiles' : 'Aula de Informática');
  
  const colors = stage === Stage.PRIMARY 
    ? { primary: 'blue', text: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', gradient: 'from-blue-600 to-indigo-600' }
    : { primary: 'emerald', text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', gradient: 'from-emerald-600 to-teal-600' };

  useEffect(() => {
    if (stage === Stage.PRIMARY) {
        setCurrentResource('ROOM');
    }
  }, [stage]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const [bData, tData, cData] = await Promise.all([
            getBookings(), 
            getTeachers(),
            getClasses()
        ]);
        setBookings(bData);
        setTeachers(tData);
        setImportedClasses(cData);
      } catch (err) {
        setError("Error de conexión.");
      } finally {
        setLoading(false);
      }
    };
    init();

    const socket = io();
    socket.on('server:bookings_updated', setBookings);
    return () => { socket.disconnect(); };
  }, []);

  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
        const bookingResource = b.resource || 'ROOM';
        const matchContext = b.stage === stage && bookingResource === currentResource;
        const matchTeacher = !teacherFilter || b.teacherName.toLowerCase().includes(teacherFilter.toLowerCase());
        const matchCourse = !courseFilter || b.course?.toLowerCase().includes(courseFilter.toLowerCase());
        return matchContext && matchTeacher && matchCourse;
    });
  }, [bookings, teacherFilter, courseFilter, stage, currentResource]);

  const handleSlotClick = (day: Date, slot: TimeSlot) => {
    if (!isBookableDay(day)) return;
    const realDateStr = formatDate(day);
    const existing = filteredBookings.find(b => b.date === realDateStr && b.slotId === slot.id);
    
    setExistingBooking(existing || null);
    setSelectedSlot({ date: day, slot });
    
    const defaultCourse = courses[0] || '';
    setCourse(existing?.course || defaultCourse);
    setSubject(existing?.subject || '');
    setJustification(existing?.justification || '');
    
    if (existing) {
        setSelectedTeacherEmail(existing.teacherEmail);
    } else if (user.role === Role.ADMIN && teachers.length > 0) {
        setSelectedTeacherEmail(teachers[0].email);
    } else {
        setSelectedTeacherEmail(user.email);
    }

    setBlockReason(existing?.justification || '');
    setIsBlocking(existing?.isBlocked || false);
    setIsModalOpen(true);
  };

  const handleSaveBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot || existingBooking) return;
    setIsSubmitting(true);

    const teacherObj = teachers.find(t => t.email === selectedTeacherEmail) || { name: user.name, email: user.email };

    const baseBooking = {
      slotId: selectedSlot.slot.id,
      stage,
      resource: currentResource,
      teacherEmail: isBlocking ? 'admin@colegiolahispanidad.es' : teacherObj.email,
      teacherName: isBlocking ? 'ADMINISTRADOR' : teacherObj.name,
      course: isBlocking ? undefined : course,
      subject: isBlocking ? undefined : subject,
      justification: isBlocking ? blockReason : justification,
      isBlocked: isBlocking,
      createdAt: Date.now(),
      logs: [{
          action: (isBlocking ? 'BLOCKED' : 'CREATED') as 'BLOCKED' | 'CREATED' | 'DELETED',
          user: user.email,
          userName: user.name,
          timestamp: Date.now(),
          details: isBlocking 
            ? blockReason 
            : `${course} - ${subject} (${currentResource === 'CART' ? 'Carro' : 'Aula'})`
      }]
    };

    try {
      if (isRecurring && user.role === Role.ADMIN && recurringEndDate) {
          const batch: Booking[] = [];
          let loop = selectedSlot.date;
          while (loop <= new Date(recurringEndDate)) {
              if (isBookableDay(loop)) {
                batch.push({ 
                  ...baseBooking, 
                  id: crypto.randomUUID(), 
                  date: formatDate(loop) 
                } as Booking);
              }
              loop = addWeeks(loop, 1);
          }
          await saveBatchBookings(batch);
      } else {
          await saveBooking({ 
            ...baseBooking, 
            id: crypto.randomUUID(), 
            date: formatDate(selectedSlot.date) 
          } as Booking);
      }
      setIsModalOpen(false);
    } catch (e: any) {
      alert(e.message === 'CONFLICT' ? "Hueco ocupado." : "Error al guardar.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const weekDays = getWeekDays(currentDate);

  return (
    // CONTENEDOR PRINCIPAL: Aseguramos que no haya scroll en el body, solo en la tabla
    <div className="flex flex-col h-[calc(100vh-64px)] md:h-[calc(100vh-80px)] w-full max-w-full overflow-hidden px-2 md:px-4 py-2 md:py-8">
      
      {/* --- HEADER (FIJO) --- */}
      <div className="flex-none flex flex-col gap-3 mb-4 w-full">
          <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center glass-panel p-3 rounded-2xl md:rounded-3xl gap-3 w-full">
            
            {/* ROW 1: Título y Back */}
            <div className="flex items-center justify-between w-full lg:w-auto">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2 md:p-2.5 hover:bg-slate-100 rounded-xl bg-white border border-slate-100 shadow-sm shrink-0">
                        <ArrowLeft className="h-5 w-5"/>
                    </button>
                    <div>
                        <h2 className={`text-base md:text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r ${colors.gradient} leading-tight truncate max-w-[200px] md:max-w-none`}>{roomName}</h2>
                        <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider">{stage === Stage.PRIMARY ? 'Primaria' : 'Secundaria'}</p>
                    </div>
                </div>

                {/* Admin Tools (Mobile Icon Only) */}
                {user.role === Role.ADMIN && (
                    <div className="flex gap-2 lg:hidden">
                         <button onClick={() => setIsHistoryOpen(true)} className="p-2 bg-white border border-slate-100 rounded-xl shadow-sm"><History className="w-5 h-5 text-slate-600"/></button>
                         <button onClick={() => setShowFilters(!showFilters)} className={`p-2 rounded-xl shadow-sm border ${showFilters ? 'bg-slate-800 text-white' : 'bg-white text-slate-600'}`}><Filter className="w-5 h-5"/></button>
                    </div>
                )}
            </div>

            {/* ROW 2: Resource Toggle (Solo Secundaria - ANCHO COMPLETO EN MÓVIL) */}
            {stage === Stage.SECONDARY && (
                <div className="w-full lg:w-auto">
                    <div className="grid grid-cols-2 gap-1 bg-slate-100/80 p-1 rounded-xl w-full">
                        <button 
                            onClick={() => setCurrentResource('ROOM')}
                            className={`flex items-center justify-center gap-2 px-2 py-2.5 rounded-lg text-xs md:text-sm font-bold transition-all ${currentResource === 'ROOM' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <Monitor className="w-4 h-4 shrink-0" />
                            <span>Aula Info</span>
                        </button>
                        <button 
                            onClick={() => setCurrentResource('CART')}
                            className={`flex items-center justify-center gap-2 px-2 py-2.5 rounded-lg text-xs md:text-sm font-bold transition-all ${currentResource === 'CART' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <Laptop className="w-4 h-4 shrink-0" />
                            <span>Carro</span>
                        </button>
                    </div>
                </div>
            )}

            {/* ROW 3: Date Navigator & Admin Tools (Desktop) */}
            <div className="flex flex-col md:flex-row items-center gap-2 w-full lg:w-auto">
                
                {/* Date Navigator (ANCHO COMPLETO EN MÓVIL, centrado) */}
                <div className="flex items-center justify-between w-full lg:w-auto space-x-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
                    <button onClick={() => setCurrentDate(subWeeks(currentDate, 1))} className="p-2 bg-white rounded-lg shadow-sm border border-slate-100"><ChevronLeft className="w-5 h-5 text-slate-600"/></button>
                    <div className="flex-1 px-2 text-center flex flex-col justify-center">
                        <span className="block text-sm font-bold text-slate-800 capitalize leading-tight">{format(weekDays[0], 'MMMM', { locale: es })}</span>
                        <span className="text-[10px] font-bold text-slate-400 leading-tight">{format(weekDays[0], 'yyyy')}</span>
                    </div>
                    <button onClick={() => setCurrentDate(addWeeks(currentDate, 1))} className="p-2 bg-white rounded-lg shadow-sm border border-slate-100"><ChevronRight className="w-5 h-5 text-slate-600"/></button>
                </div>

                {/* Admin Tools (Desktop) */}
                {user.role === Role.ADMIN && (
                    <div className="hidden lg:flex gap-2">
                        <button onClick={() => setIsHistoryOpen(true)} className="p-2.5 bg-white border border-slate-100 rounded-xl shadow-sm text-slate-600"><History className="w-5 h-5"/></button>
                        <button onClick={() => setShowFilters(!showFilters)} className={`p-2.5 rounded-xl shadow-sm border ${showFilters ? 'bg-slate-800 text-white' : 'bg-white border-slate-100 text-slate-600'}`}><Filter className="w-5 h-5"/></button>
                    </div>
                )}
            </div>
          </div>

          {/* Filters Panel (Admin) */}
          {user.role === Role.ADMIN && showFilters && (
             <div className="glass-panel p-3 rounded-2xl animate-slide-up flex flex-col md:flex-row gap-3">
                 <input type="text" placeholder="Filtrar profesor..." value={teacherFilter} onChange={e => setTeacherFilter(e.target.value)} className="flex-1 p-2.5 border rounded-xl outline-none text-sm"/>
                 <select value={courseFilter} onChange={e => setCourseFilter(e.target.value)} className="flex-1 p-2.5 border rounded-xl outline-none text-sm bg-white">
                    <option value="">Todos los cursos</option>
                    {courses.map(c => <option key={c} value={c}>{c}</option>)}
                 </select>
             </div>
          )}
      </div>

      {/* --- GRID (SCROLLABLE) --- */}
      {/* flex-1 toma el espacio restante. overflow-hidden evita que este div haga scroll en la página. */}
      {/* El div interno maneja el scroll horizontal de la tabla. */}
      <div className="flex-1 glass-panel rounded-[1.5rem] md:rounded-[2.5rem] overflow-hidden shadow-xl flex flex-col border-slate-200/60 w-full relative">
        <div className="w-full h-full overflow-auto">
            <div className="min-w-[700px] md:min-w-[900px] h-full pb-2"> 
              
              {/* Table Header */}
              <div className="grid grid-cols-[60px_repeat(5,1fr)] md:grid-cols-[100px_repeat(5,1fr)] sticky top-0 z-20 bg-white shadow-sm border-b border-slate-100">
                <div className="p-2 md:p-5 border-r border-slate-100 bg-white"></div>
                {weekDays.slice(0, 5).map(day => (
                    <div key={day.toISOString()} className="p-2 md:p-4 text-center border-r border-slate-100 bg-white">
                        <div className="text-lg md:text-2xl font-black text-slate-800">{format(day, 'd')}</div>
                        <div className="text-[10px] md:text-xs font-bold uppercase text-slate-400">{format(day, 'EEE', { locale: es })}</div>
                    </div>
                ))}
              </div>

              {/* Slots */}
              {slots.map(slot => (
                <div key={slot.id} className="grid grid-cols-[60px_repeat(5,1fr)] md:grid-cols-[100px_repeat(5,1fr)] border-b border-slate-100 last:border-0">
                  
                  {/* Time Label */}
                  <div className="p-1 md:p-4 flex flex-col items-center justify-center text-[10px] md:text-xs font-bold text-slate-500 bg-slate-50/50 border-r border-slate-100">
                    <span>{slot.start}</span>
                    <span className="text-slate-300 hidden md:inline">-</span>
                    <span className="text-slate-400">{slot.end}</span>
                  </div>
                  
                  {/* Days */}
                  {weekDays.slice(0, 5).map(day => {
                    const booking = filteredBookings.find(b => b.date === formatDate(day) && b.slotId === slot.id);
                    const isHoliday = !isBookableDay(day);
                    return (
                        <div key={day.toISOString()} className="min-h-[90px] md:min-h-[120px] p-1 md:p-2 border-r border-slate-100 relative group cursor-pointer" onClick={() => handleSlotClick(day, slot)}>
                             {isHoliday ? (
                                <div className="h-full flex items-center justify-center bg-slate-50/50 text-[10px] text-slate-300 font-black uppercase -rotate-6 tracking-wider select-none">No Lectivo</div>
                             ) : booking ? (
                                <div className={`h-full rounded-lg md:rounded-xl p-1.5 md:p-3 border shadow-sm flex flex-col ${booking.isBlocked ? 'bg-slate-800 text-white' : colors.bg + ' ' + colors.text}`}>
                                    <p className="text-[10px] md:text-xs font-black truncate leading-tight">{booking.isBlocked ? 'BLOQUEADO' : booking.course}</p>
                                    <p className="text-[9px] md:text-[10px] opacity-90 truncate leading-tight mt-0.5">{booking.isBlocked ? booking.justification : booking.subject}</p>
                                    <p className="mt-auto text-[8px] md:text-[9px] font-bold border-t border-current/10 pt-1 truncate">{booking.teacherName.split(' ')[0]}</p>
                                </div>
                             ) : (
                                <div className="h-full border border-dashed border-slate-100 rounded-lg md:rounded-xl group-hover:bg-slate-50/80 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                    <span className="text-xl text-slate-300">+</span>
                                </div>
                             )}
                        </div>
                    );
                  })}
                </div>
              ))}
            </div>
        </div>
      </div>

      <HistoryModal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} />
      
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={existingBooking ? 'Detalles' : 'Nueva Reserva'}>
        {/* ... Modal content remains same as previous ... */}
        {existingBooking ? (
            <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Responsable</p>
                    <p className="font-bold text-slate-900">{existingBooking.teacherName}</p>
                    <p className="text-xs text-slate-500">{existingBooking.teacherEmail}</p>
                    <div className="mt-2 text-[10px] bg-white border border-slate-200 inline-block px-2 py-0.5 rounded-md text-slate-600 font-bold uppercase tracking-wider">
                        {existingBooking.resource === 'CART' ? 'Carro Portátiles' : 'Aula Informática'}
                    </div>
                </div>
                {!existingBooking.isBlocked && (
                    <>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 border rounded-xl bg-white"><p className="text-[10px] font-bold uppercase text-slate-400">Curso</p><p className="text-sm font-bold text-slate-800">{existingBooking.course}</p></div>
                            <div className="p-3 border rounded-xl bg-white"><p className="text-[10px] font-bold uppercase text-slate-400">Asignatura</p><p className="text-sm font-bold text-slate-800">{existingBooking.subject}</p></div>
                        </div>
                        <div className="p-3 border rounded-xl bg-slate-50">
                            <p className="text-[10px] font-bold uppercase text-slate-500">Justificación / Actividad</p>
                            <p className="text-sm text-slate-700 italic">{existingBooking.justification || 'Sin justificación'}</p>
                        </div>
                    </>
                )}
                {(user.role === Role.ADMIN || existingBooking.teacherEmail === user.email) && (
                    <button onClick={async () => { await removeBooking(existingBooking.id, user); setIsModalOpen(false); }} className="w-full py-3.5 bg-red-50 text-red-600 rounded-xl font-bold border border-red-100 hover:bg-red-100 transition-colors">Eliminar Reserva</button>
                )}
            </div>
        ) : (
            <form onSubmit={handleSaveBooking} className="space-y-4">
                {user.role === Role.ADMIN && (
                    <div className="flex gap-2">
                        <button type="button" onClick={() => setIsBlocking(!isBlocking)} className={`flex-1 p-3 rounded-xl border font-bold text-[10px] uppercase tracking-wider ${isBlocking ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600'}`}>{isBlocking ? 'Modo Bloqueo' : 'Bloquear'}</button>
                        <button type="button" onClick={() => setIsRecurring(!isRecurring)} className={`flex-1 p-3 rounded-xl border font-bold text-[10px] uppercase tracking-wider ${isRecurring ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-blue-600 border-blue-100'}`}>{isRecurring ? 'Recurrencia ON' : 'Recurrencia'}</button>
                    </div>
                )}
                
                <div className="text-center text-xs font-bold text-slate-400 bg-slate-50 p-2 rounded-lg border border-dashed border-slate-200">
                    Reservando en: <span className="text-slate-700 uppercase">{currentResource === 'CART' ? 'Carro de Portátiles' : 'Aula Estándar'}</span>
                </div>

                {!isBlocking ? (
                    <>
                        {user.role === Role.ADMIN && (
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Profesor Responsable</label>
                                <select value={selectedTeacherEmail} onChange={e => setSelectedTeacherEmail(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-brand-500/20">
                                    {teachers.map(t => <option key={t.email} value={t.email}>{t.name}</option>)}
                                </select>
                            </div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Curso</label>
                                <select value={course} onChange={e => setCourse(e.target.value)} className="w-full p-3 border border-slate-200 rounded-xl font-bold text-sm bg-white outline-none focus:ring-2 focus:ring-brand-500/20">
                                    {courses.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                {stage === Stage.SECONDARY && currentResource === 'CART' && (
                                    <p className="text-[10px] text-amber-600 mt-1 font-bold">* Limitado a 3º y 4º ESO</p>
                                )}
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Asignatura</label>
                                <input type="text" required value={subject} onChange={e => setSubject(e.target.value)} placeholder="Ej: Matemáticas" className="w-full p-3 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-brand-500/20"/>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Justificación / Actividad <span className="text-red-500">*</span></label>
                            <textarea required value={justification} onChange={e => setJustification(e.target.value)} placeholder="Describa brevemente la actividad..." className="w-full p-3 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-brand-500/20" rows={2}/>
                        </div>
                    </>
                ) : (
                    <textarea required value={blockReason} onChange={e => setBlockReason(e.target.value)} placeholder="Motivo del bloqueo..." className="w-full p-4 border rounded-xl font-bold text-sm" rows={3}/>
                )}

                {isRecurring && user.role === Role.ADMIN && (
                    <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
                        <label className="block text-[10px] font-bold text-blue-600 uppercase mb-1">Fecha fin de recurrencia</label>
                        <input type="date" required value={recurringEndDate} onChange={e => setRecurringEndDate(e.target.value)} className="w-full p-2 border rounded-lg font-bold bg-white text-sm"/>
                    </div>
                )}

                <button type="submit" disabled={isSubmitting} className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold shadow-lg flex items-center justify-center active:scale-95 transition-transform">
                    {isSubmitting ? <Loader2 className="animate-spin w-5 h-5"/> : 'Confirmar Reserva'}
                </button>
            </form>
        )}
      </Modal>
    </div>
  );
};