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
  const [selectedSlot, setSelectedSlot] = useState<{ date: Date, slot: TimeSlot } | null>(null);
  const [existingBooking, setExistingBooking] = useState<Booking | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentResource, setCurrentResource] = useState<ResourceType>('ROOM');
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
  
  // Sincronizar selectedTeacherEmail cuando cargan los profesores y somos admin
  useEffect(() => {
    if (user.role === Role.ADMIN && teachers.length > 0 && selectedTeacherEmail === user.email) {
        setSelectedTeacherEmail(teachers[0].email);
    }
  }, [teachers, user.role, selectedTeacherEmail, user.email]);

  const courses = useMemo(() => {
    let baseList = (importedClasses.length > 0) ? importedClasses.map(c => c.name) : (stage === Stage.PRIMARY ? COURSES_PRIMARY : COURSES_SECONDARY);
    if (stage === Stage.PRIMARY) {
        baseList = baseList.filter(n => n.toUpperCase().includes('PRI') || n.match(/^[1-6]º/));
    } else {
        baseList = baseList.filter(n => n.toUpperCase().includes('ESO') || n.toUpperCase().includes('BAC') || n.toUpperCase().includes('SEC'));
    }
    if (stage === Stage.SECONDARY && currentResource === 'CART') {
        baseList = baseList.filter(c => c.includes('3º') || c.includes('4º'));
    }
    return baseList.length > 0 ? baseList.sort() : (stage === Stage.PRIMARY ? COURSES_PRIMARY : COURSES_SECONDARY);
  }, [stage, currentResource, importedClasses]);

  const roomName = stage === Stage.PRIMARY ? 'Aula de Idiomas' : (currentResource === 'CART' ? 'Carro de Portátiles' : 'Aula de Informática');
  const colors = stage === Stage.PRIMARY 
    ? { primary: 'blue', text: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', gradient: 'from-blue-600 to-indigo-600' }
    : { primary: 'emerald', text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', gradient: 'from-emerald-600 to-teal-600' };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const [bData, tData, cData] = await Promise.all([getBookings(), getTeachers(), getClasses()]);
        setBookings(bData);
        setTeachers(tData.sort((a,b) => a.name.localeCompare(b.name)));
        setImportedClasses(cData);
      } catch (err) { console.error(err); } finally { setLoading(false); }
    };
    init();
    const socket = io();
    socket.on('server:bookings_updated', setBookings);
    return () => { socket.disconnect(); };
  }, []);

  const filteredBookings = useMemo(() => {
    return bookings.filter(b => (b.resource || 'ROOM') === currentResource && b.stage === stage && 
      (!teacherFilter || b.teacherName.toLowerCase().includes(teacherFilter.toLowerCase())) &&
      (!courseFilter || b.course?.toLowerCase().includes(courseFilter.toLowerCase())));
  }, [bookings, teacherFilter, courseFilter, stage, currentResource]);

  const handleSlotClick = (day: Date, slot: TimeSlot) => {
    if (!isBookableDay(day)) return;
    const existing = filteredBookings.find(b => b.date === formatDate(day) && b.slotId === slot.id);
    setExistingBooking(existing || null);
    setSelectedSlot({ date: day, slot });
    setCourse(existing?.course || courses[0] || '');
    setSubject(existing?.subject || '');
    setJustification(existing?.justification || '');
    setSelectedTeacherEmail(existing?.teacherEmail || (user.role === Role.ADMIN && teachers.length > 0 ? teachers[0].email : user.email));
    setBlockReason(existing?.justification || '');
    setIsBlocking(existing?.isBlocked || false);
    setIsModalOpen(true);
  };

  const handleSaveBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot || isSubmitting) return;
    setIsSubmitting(true);
    const teacherObj = teachers.find(t => t.email === selectedTeacherEmail) || { name: user.name, email: user.email };
    const baseBooking = {
      slotId: selectedSlot.slot.id, stage, resource: currentResource,
      teacherEmail: isBlocking ? 'admin@colegiolahispanidad.es' : teacherObj.email,
      teacherName: isBlocking ? 'ADMINISTRADOR' : teacherObj.name,
      course: isBlocking ? undefined : course, subject: isBlocking ? undefined : subject,
      justification: isBlocking ? blockReason : justification, isBlocked: isBlocking, createdAt: Date.now(),
      logs: [{ action: isBlocking ? 'BLOCKED' : 'CREATED', user: user.email, userName: user.name, timestamp: Date.now(), details: isBlocking ? blockReason : `${course} - ${subject}` }]
    };
    try {
      if (isRecurring && user.role === Role.ADMIN && recurringEndDate) {
          const batch: Booking[] = [];
          let loop = selectedSlot.date;
          while (loop <= new Date(recurringEndDate)) {
              if (isBookableDay(loop)) batch.push({ ...baseBooking, id: crypto.randomUUID(), date: formatDate(loop) } as Booking);
              loop = addWeeks(loop, 1);
          }
          await saveBatchBookings(batch);
      } else {
          await saveBooking({ ...baseBooking, id: crypto.randomUUID(), date: formatDate(selectedSlot.date) } as Booking);
      }
      setIsModalOpen(false);
    } catch (e: any) { alert("Error al guardar."); } finally { setIsSubmitting(false); }
  };

  const weekDays = getWeekDays(currentDate);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] md:h-[calc(100vh-80px)] w-full max-w-full overflow-hidden px-2 md:px-4 py-2 md:py-8">
      <div className="flex-none flex flex-col gap-3 mb-4 w-full">
          <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center glass-panel p-3 rounded-2xl md:rounded-3xl gap-3 w-full">
            <div className="flex items-center justify-between w-full lg:w-auto">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-xl bg-white border border-slate-100 shadow-sm shrink-0"><ArrowLeft className="h-5 w-5"/></button>
                    <div>
                        <h2 className={`text-base md:text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r ${colors.gradient} leading-tight truncate`}>{roomName}</h2>
                        <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider">{stage}</p>
                    </div>
                </div>
                {user.role === Role.ADMIN && (
                    <div className="flex gap-2 lg:hidden">
                         <button onClick={() => setIsHistoryOpen(true)} className="p-2 bg-white border border-slate-100 rounded-xl shadow-sm"><History className="w-5 h-5"/></button>
                         <button onClick={() => setShowFilters(!showFilters)} className={`p-2 rounded-xl border ${showFilters ? 'bg-slate-800 text-white' : 'bg-white'}`}><Filter className="w-5 h-5"/></button>
                    </div>
                )}
            </div>
            {stage === Stage.SECONDARY && (
                <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-xl">
                    <button onClick={() => setCurrentResource('ROOM')} className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${currentResource === 'ROOM' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500'}`}><Monitor className="w-4 h-4" />Aula</button>
                    <button onClick={() => setCurrentResource('CART')} className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${currentResource === 'CART' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500'}`}><Laptop className="w-4 h-4" />Carro</button>
                </div>
            )}
            <div className="flex items-center justify-between w-full lg:w-auto space-x-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
                <button onClick={() => setCurrentDate(subWeeks(currentDate, 1))} className="p-2 bg-white rounded-lg shadow-sm"><ChevronLeft className="w-5 h-5"/></button>
                <div className="flex-1 text-center"><span className="block text-sm font-bold text-slate-800 capitalize">{format(weekDays[0], 'MMMM yyyy', { locale: es })}</span></div>
                <button onClick={() => setCurrentDate(addWeeks(currentDate, 1))} className="p-2 bg-white rounded-lg shadow-sm"><ChevronRight className="w-5 h-5"/></button>
            </div>
          </div>
          {user.role === Role.ADMIN && showFilters && (
             <div className="glass-panel p-3 rounded-2xl flex flex-col md:flex-row gap-3">
                 <input type="text" placeholder="Filtrar profesor..." value={teacherFilter} onChange={e => setTeacherFilter(e.target.value)} className="flex-1 p-2.5 border rounded-xl text-sm outline-none"/>
                 <select value={courseFilter} onChange={e => setCourseFilter(e.target.value)} className="flex-1 p-2.5 border rounded-xl text-sm outline-none bg-white">
                    <option value="">Todos los cursos</option>
                    {courses.map(c => <option key={c} value={c}>{c}</option>)}
                 </select>
             </div>
          )}
      </div>

      <div className="flex-1 glass-panel rounded-[1.5rem] overflow-hidden shadow-xl flex flex-col relative">
        <div className="w-full h-full overflow-auto">
            <div className="min-w-[700px] h-full"> 
              <div className="grid grid-cols-[60px_repeat(5,1fr)] md:grid-cols-[100px_repeat(5,1fr)] sticky top-0 z-20 bg-white border-b border-slate-100">
                <div className="bg-white"></div>
                {weekDays.slice(0, 5).map(day => (
                    <div key={day.toISOString()} className="p-2 md:p-4 text-center border-r border-slate-100 bg-white">
                        <div className="text-lg md:text-2xl font-black text-slate-800">{format(day, 'd')}</div>
                        <div className="text-[10px] md:text-xs font-bold uppercase text-slate-400">{format(day, 'EEE', { locale: es })}</div>
                    </div>
                ))}
              </div>
              {slots.map(slot => (
                <div key={slot.id} className="grid grid-cols-[60px_repeat(5,1fr)] md:grid-cols-[100px_repeat(5,1fr)] border-b border-slate-100">
                  <div className="p-4 flex flex-col items-center justify-center text-[10px] md:text-xs font-bold text-slate-500 bg-slate-50 border-r border-slate-100">
                    <span>{slot.start}</span><span className="text-slate-400">{slot.end}</span>
                  </div>
                  {weekDays.slice(0, 5).map(day => {
                    const booking = filteredBookings.find(b => b.date === formatDate(day) && b.slotId === slot.id);
                    const isHoliday = !isBookableDay(day);
                    return (
                        <div key={day.toISOString()} className="min-h-[100px] p-2 border-r border-slate-100 relative group cursor-pointer" onClick={() => handleSlotClick(day, slot)}>
                             {isHoliday ? (
                                <div className="h-full flex items-center justify-center bg-slate-50/50 text-[10px] text-slate-300 font-black uppercase -rotate-6">No Lectivo</div>
                             ) : booking ? (
                                <div className={`h-full rounded-xl p-2 border shadow-sm flex flex-col ${booking.isBlocked ? 'bg-slate-800 text-white' : colors.bg + ' ' + colors.text}`}>
                                    <p className="text-[10px] font-black truncate leading-tight">{booking.isBlocked ? 'BLOQUEADO' : booking.course}</p>
                                    <p className="text-[9px] truncate leading-tight mt-0.5">{booking.isBlocked ? booking.justification : booking.subject}</p>
                                    <p className="mt-auto text-[8px] font-bold border-t border-current/10 pt-1 truncate">{booking.teacherName}</p>
                                </div>
                             ) : (
                                <div className="h-full border border-dashed border-slate-100 rounded-xl group-hover:bg-slate-50 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center text-xl text-slate-300">+</div>
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
        {existingBooking ? (
            <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Responsable</p>
                    <p className="font-bold text-slate-900">{existingBooking.teacherName}</p>
                    <p className="text-xs text-slate-500">{existingBooking.teacherEmail}</p>
                </div>
                {!existingBooking.isBlocked && (
                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 border rounded-xl bg-white"><p className="text-[10px] font-bold uppercase text-slate-400">Curso</p><p className="text-sm font-bold">{existingBooking.course}</p></div>
                        <div className="p-3 border rounded-xl bg-white"><p className="text-[10px] font-bold uppercase text-slate-400">Asignatura</p><p className="text-sm font-bold">{existingBooking.subject}</p></div>
                    </div>
                )}
                {(user.role === Role.ADMIN || existingBooking.teacherEmail === user.email) && (
                    <button onClick={async () => { await removeBooking(existingBooking.id, user); setIsModalOpen(false); }} className="w-full py-3 bg-red-50 text-red-600 rounded-xl font-bold border border-red-100">Eliminar</button>
                )}
            </div>
        ) : (
            <form onSubmit={handleSaveBooking} className="space-y-4">
                {user.role === Role.ADMIN && (
                    <div className="flex gap-2">
                        <button type="button" onClick={() => setIsBlocking(!isBlocking)} className={`flex-1 p-3 rounded-xl border font-bold text-[10px] uppercase ${isBlocking ? 'bg-slate-800 text-white' : 'bg-white'}`}>Bloquear</button>
                        <button type="button" onClick={() => setIsRecurring(!isRecurring)} className={`flex-1 p-3 rounded-xl border font-bold text-[10px] uppercase ${isRecurring ? 'bg-blue-600 text-white' : 'bg-white text-blue-600'}`}>Recurrencia</button>
                    </div>
                )}
                {!isBlocking ? (
                    <>
                        {user.role === Role.ADMIN && (
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Profesor Responsable</label>
                                <select value={selectedTeacherEmail} onChange={e => setSelectedTeacherEmail(e.target.value)} className="w-full p-3 bg-slate-50 border rounded-xl font-bold text-sm outline-none">
                                    {teachers.length === 0 && <option>Cargando lista de tutores...</option>}
                                    {teachers.map(t => <option key={t.email} value={t.email}>{t.name}</option>)}
                                </select>
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Curso</label><select value={course} onChange={e => setCourse(e.target.value)} className="w-full p-3 border rounded-xl font-bold text-sm bg-white outline-none">{courses.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Asignatura</label><input type="text" required value={subject} onChange={e => setSubject(e.target.value)} className="w-full p-3 border rounded-xl font-bold text-sm outline-none"/></div>
                        </div>
                        <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Actividad</label><textarea required value={justification} onChange={e => setJustification(e.target.value)} className="w-full p-3 border rounded-xl font-bold text-sm outline-none" rows={2}/></div>
                    </>
                ) : (
                    <textarea required value={blockReason} onChange={e => setBlockReason(e.target.value)} placeholder="Motivo del bloqueo..." className="w-full p-4 border rounded-xl font-bold text-sm" rows={3}/>
                )}
                {isRecurring && user.role === Role.ADMIN && (
                    <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl"><label className="block text-[10px] font-bold text-blue-600 uppercase mb-1">Fecha fin</label><input type="date" required value={recurringEndDate} onChange={e => setRecurringEndDate(e.target.value)} className="w-full p-2 border rounded-lg font-bold text-sm"/></div>
                )}
                <button type="submit" disabled={isSubmitting} className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold shadow-lg flex items-center justify-center">
                    {isSubmitting ? <Loader2 className="animate-spin w-5 h-5"/> : 'Confirmar Reserva'}
                </button>
            </form>
        )}
      </Modal>
    </div>
  );
};
