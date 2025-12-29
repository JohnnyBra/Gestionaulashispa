import React, { useState, useEffect, useMemo } from 'react';
import { Stage, User, TimeSlot, Booking, SLOTS_PRIMARY, SLOTS_SECONDARY, COURSES_PRIMARY, COURSES_SECONDARY, Role, ActionLog } from '../types';
import { getBookings, saveBooking, saveBatchBookings, removeBooking, getTeachers } from '../services/storageService';
import { formatDate, getWeekDays, isBookableDay } from '../utils/dateUtils';
import { Modal } from '../components/Modal';
import { HistoryModal } from '../components/HistoryModal';
import { ChevronLeft, ChevronRight, Lock, User as UserIcon, Book, ArrowLeft, Trash2, Loader2, History, Filter, Search, XCircle, MoreHorizontal, Repeat, CalendarDays } from 'lucide-react';
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
  const [teachers, setTeachers] = useState<{name: string, email: string}[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ date: Date, slot: TimeSlot } | null>(null);
  const [existingBooking, setExistingBooking] = useState<Booking | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Admin Tools State
  const [teacherFilter, setTeacherFilter] = useState('');
  const [courseFilter, setCourseFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Form State
  const [course, setCourse] = useState('');
  const [subject, setSubject] = useState('');
  const [selectedTeacherEmail, setSelectedTeacherEmail] = useState(user.email);
  const [blockReason, setBlockReason] = useState('');
  const [isBlocking, setIsBlocking] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringEndDate, setRecurringEndDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const slots = stage === Stage.PRIMARY ? SLOTS_PRIMARY : SLOTS_SECONDARY;
  const courses = stage === Stage.PRIMARY ? COURSES_PRIMARY : COURSES_SECONDARY;
  const roomName = stage === Stage.PRIMARY ? 'Aula de Idiomas' : 'Aula de Informática';
  
  const colors = stage === Stage.PRIMARY 
    ? { primary: 'blue', text: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', gradient: 'from-blue-600 to-indigo-600' }
    : { primary: 'emerald', text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', gradient: 'from-emerald-600 to-teal-600' };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const [bData, tData] = await Promise.all([getBookings(), getTeachers()]);
        setBookings(bData);
        setTeachers(tData);
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
        const matchTeacher = !teacherFilter || b.teacherName.toLowerCase().includes(teacherFilter.toLowerCase());
        const matchCourse = !courseFilter || b.course?.toLowerCase().includes(courseFilter.toLowerCase());
        return matchTeacher && matchCourse;
    });
  }, [bookings, teacherFilter, courseFilter]);

  const handleSlotClick = (day: Date, slot: TimeSlot) => {
    if (!isBookableDay(day)) return;
    const realDateStr = formatDate(day);
    const existing = bookings.find(b => b.date === realDateStr && b.slotId === slot.id && b.stage === stage);
    
    setExistingBooking(existing || null);
    setSelectedSlot({ date: day, slot });
    
    setCourse(existing?.course || courses[0]);
    setSubject(existing?.subject || '');
    
    // Gestión inteligente del selector de profesor para ADMIN
    if (existing) {
        setSelectedTeacherEmail(existing.teacherEmail);
    } else if (user.role === Role.ADMIN && teachers.length > 0) {
        // Si es nueva reserva y somos admin, seleccionamos el primer profe de la lista importada
        // para evitar que se seleccione el email del admin (que suele no estar en la lista de profes)
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

    // Explicitly type log action to avoid inference as generic string
    const baseBooking = {
      slotId: selectedSlot.slot.id,
      stage,
      teacherEmail: isBlocking ? 'admin@colegiolahispanidad.es' : teacherObj.email,
      teacherName: isBlocking ? 'ADMINISTRADOR' : teacherObj.name,
      course: isBlocking ? undefined : course,
      subject: isBlocking ? undefined : subject,
      isBlocked: isBlocking,
      justification: isBlocking ? blockReason : undefined,
      createdAt: Date.now(),
      logs: [{
          action: (isBlocking ? 'BLOCKED' : 'CREATED') as 'BLOCKED' | 'CREATED' | 'DELETED',
          user: user.email,
          userName: user.name,
          timestamp: Date.now(),
          details: isBlocking ? blockReason : `${course} - ${subject}`
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
    <div className="max-w-screen-2xl mx-auto px-4 py-8 flex flex-col h-[calc(100vh-80px)]">
      {/* Header & Filters */}
      <div className="flex-none flex flex-col gap-4 mb-6">
          <div className="flex flex-col md:flex-row justify-between items-center glass-panel p-4 rounded-3xl gap-4">
            <div className="flex items-center space-x-4">
              <button onClick={onBack} className="p-3 hover:bg-slate-100 rounded-2xl"><ArrowLeft className="h-5 w-5"/></button>
              <div><h2 className={`text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r ${colors.gradient}`}>{roomName}</h2></div>
            </div>
            <div className="flex items-center gap-3">
                {user.role === Role.ADMIN && (
                    <div className="flex gap-2">
                        <button onClick={() => setIsHistoryOpen(true)} className="p-3 bg-slate-100 rounded-xl"><History/></button>
                        <button onClick={() => setShowFilters(!showFilters)} className={`p-3 rounded-xl ${showFilters ? 'bg-slate-800 text-white' : 'bg-slate-100'}`}><Filter/></button>
                    </div>
                )}
                <div className="flex items-center space-x-4 bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
                    <button onClick={() => setCurrentDate(subWeeks(currentDate, 1))} className="p-2.5"><ChevronLeft/></button>
                    <div className="px-4 text-center">
                        <span className="block text-sm font-bold text-slate-800 capitalize">{format(weekDays[0], 'MMMM', { locale: es })}</span>
                        <span className="text-[10px] font-bold text-slate-400">{format(weekDays[0], 'yyyy')}</span>
                    </div>
                    <button onClick={() => setCurrentDate(addWeeks(currentDate, 1))} className="p-2.5"><ChevronRight/></button>
                </div>
            </div>
          </div>
          {user.role === Role.ADMIN && showFilters && (
             <div className="glass-panel p-4 rounded-2xl animate-slide-up flex flex-col md:flex-row gap-4">
                 <input type="text" placeholder="Filtrar profesor..." value={teacherFilter} onChange={e => setTeacherFilter(e.target.value)} className="flex-1 p-2 border rounded-xl outline-none"/>
                 <select value={courseFilter} onChange={e => setCourseFilter(e.target.value)} className="flex-1 p-2 border rounded-xl outline-none">
                    <option value="">Todos los cursos</option>
                    {courses.map(c => <option key={c} value={c}>{c}</option>)}
                 </select>
             </div>
          )}
      </div>

      {/* Grid */}
      <div className="flex-1 glass-panel rounded-[2.5rem] overflow-hidden shadow-xl flex flex-col">
        <div className="overflow-auto flex-1">
            <div className="min-w-[900px]">
              <div className="grid grid-cols-[100px_repeat(5,1fr)] sticky top-0 z-20 bg-white">
                <div className="p-5 border-r"></div>
                {weekDays.slice(0, 5).map(day => (
                    <div key={day.toISOString()} className="p-4 text-center border-r">
                        <div className="text-2xl font-black">{format(day, 'd')}</div>
                        <div className="text-xs font-bold uppercase text-slate-400">{format(day, 'EEE', { locale: es })}</div>
                    </div>
                ))}
              </div>
              {slots.map(slot => (
                <div key={slot.id} className="grid grid-cols-[100px_repeat(5,1fr)] border-t">
                  <div className="p-4 flex flex-col items-center justify-center text-xs font-bold text-slate-500 bg-slate-50 border-r">
                    <span>{slot.start}</span>
                    <span className="text-slate-400">{slot.end}</span>
                  </div>
                  {weekDays.slice(0, 5).map(day => {
                    const booking = filteredBookings.find(b => b.date === formatDate(day) && b.slotId === slot.id && b.stage === stage);
                    const isHoliday = !isBookableDay(day);
                    return (
                        <div key={day.toISOString()} className="min-h-[120px] p-2 border-r relative group cursor-pointer" onClick={() => handleSlotClick(day, slot)}>
                             {isHoliday ? (
                                <div className="h-full flex items-center justify-center bg-slate-50/50 text-[10px] text-slate-300 font-black uppercase rotate-[-10deg]">No Lectivo</div>
                             ) : booking ? (
                                <div className={`h-full rounded-xl p-3 border shadow-sm ${booking.isBlocked ? 'bg-slate-800 text-white' : colors.bg + ' ' + colors.text}`}>
                                    <p className="text-xs font-black truncate">{booking.isBlocked ? 'BLOQUEADO' : booking.course}</p>
                                    <p className="text-[10px] opacity-80 truncate">{booking.isBlocked ? booking.justification : booking.subject}</p>
                                    <p className="mt-auto text-[9px] font-bold border-t border-current/10 pt-1">{booking.teacherName}</p>
                                </div>
                             ) : (
                                <div className="h-full border-2 border-dashed border-slate-100 rounded-xl group-hover:bg-slate-50 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
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
        {existingBooking ? (
            <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-xl">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Responsable</p>
                    <p className="font-bold">{existingBooking.teacherName}</p>
                    <p className="text-xs text-slate-500">{existingBooking.teacherEmail}</p>
                </div>
                {!existingBooking.isBlocked && (
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 border rounded-xl"><p className="text-[10px] font-bold uppercase">Curso</p><p className="text-sm font-bold">{existingBooking.course}</p></div>
                        <div className="p-3 border rounded-xl"><p className="text-[10px] font-bold uppercase">Asignatura</p><p className="text-sm font-bold">{existingBooking.subject}</p></div>
                    </div>
                )}
                {(user.role === Role.ADMIN || existingBooking.teacherEmail === user.email) && (
                    <button onClick={async () => { await removeBooking(existingBooking.id, user); setIsModalOpen(false); }} className="w-full py-3 bg-red-50 text-red-600 rounded-xl font-bold border border-red-100">Eliminar Reserva</button>
                )}
            </div>
        ) : (
            <form onSubmit={handleSaveBooking} className="space-y-4">
                {user.role === Role.ADMIN && (
                    <div className="flex gap-2">
                        <button type="button" onClick={() => setIsBlocking(!isBlocking)} className={`flex-1 p-3 rounded-xl border font-bold text-xs ${isBlocking ? 'bg-slate-800 text-white' : 'bg-white'}`}>{isBlocking ? 'MODO BLOQUEO ACTIVO' : 'ACTIVAR BLOQUEO'}</button>
                        <button type="button" onClick={() => setIsRecurring(!isRecurring)} className={`flex-1 p-3 rounded-xl border font-bold text-xs ${isRecurring ? 'bg-blue-600 text-white' : 'bg-white'}`}>{isRecurring ? 'RECURRENCIA ACTIVA' : 'RECURRENCIA'}</button>
                    </div>
                )}

                {!isBlocking ? (
                    <>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Profesor Responsable</label>
                            {user.role === Role.ADMIN ? (
                                <select value={selectedTeacherEmail} onChange={e => setSelectedTeacherEmail(e.target.value)} className="w-full p-3 bg-slate-50 border rounded-xl font-bold">
                                    {teachers.map(t => <option key={t.email} value={t.email}>{t.name} ({t.email})</option>)}
                                </select>
                            ) : (
                                <input type="text" value={user.name} disabled className="w-full p-3 bg-slate-100 border rounded-xl font-bold text-slate-500"/>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Curso</label>
                                <select value={course} onChange={e => setCourse(e.target.value)} className="w-full p-3 border rounded-xl font-bold">
                                    {courses.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Asignatura</label>
                                <input type="text" required value={subject} onChange={e => setSubject(e.target.value)} placeholder="Ej: Matemáticas" className="w-full p-3 border rounded-xl font-bold"/>
                            </div>
                        </div>
                    </>
                ) : (
                    <textarea required value={blockReason} onChange={e => setBlockReason(e.target.value)} placeholder="Motivo del bloqueo..." className="w-full p-4 border rounded-xl font-bold text-sm" rows={3}/>
                )}

                {isRecurring && user.role === Role.ADMIN && (
                    <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
                        <label className="block text-[10px] font-bold text-blue-600 uppercase mb-1">Fecha fin de recurrencia</label>
                        <input type="date" required value={recurringEndDate} onChange={e => setRecurringEndDate(e.target.value)} className="w-full p-2 border rounded-lg font-bold"/>
                    </div>
                )}

                <button type="submit" disabled={isSubmitting} className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold shadow-lg flex items-center justify-center">
                    {isSubmitting ? <Loader2 className="animate-spin"/> : 'Confirmar Reserva'}
                </button>
            </form>
        )}
      </Modal>
    </div>
  );
};