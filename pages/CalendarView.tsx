import React, { useState, useEffect, useMemo } from 'react';
import { Stage, User, TimeSlot, Booking, SLOTS_PRIMARY, SLOTS_SECONDARY, COURSES_PRIMARY, COURSES_SECONDARY, Role, ActionLog, ResourceType, ClassGroup } from '../types';
import { getBookings, saveBooking, saveBatchBookings, removeBooking, getTeachers, getClasses } from '../services/storageService';
import { formatDate, getWeekDays, isBookableDay } from '../utils/dateUtils';
import { Modal } from '../components/Modal';
import { HistoryModal } from '../components/HistoryModal';
import { ChevronLeft, ChevronRight, Lock, User as UserIcon, Book, ArrowLeft, Trash2, Loader2, History, Filter, Search, XCircle, MoreHorizontal, Repeat, CalendarDays, Laptop, Monitor } from 'lucide-react';
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
  const [importedClasses, setImportedClasses] = useState<ClassGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ date: Date, slot: TimeSlot } | null>(null);
  const [existingBooking, setExistingBooking] = useState<Booking | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Resource State (Room or Laptop Cart)
  const [currentResource, setCurrentResource] = useState<ResourceType>('ROOM');

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
  
  // LOGICA PARA OBTENER Y FILTRAR CLASES
  const courses = useMemo(() => {
    // Si no se han cargado clases de Prisma, usar fallbacks
    let baseList: string[] = [];
    
    if (importedClasses.length > 0) {
        // Filtramos por nombre para intentar adivinar la etapa si el objeto no tiene stage explícito
        // (Asumiendo que el import trae nombres como "1º ESO A", "1º PRIM A", etc)
        const allNames = importedClasses.map(c => c.name);
        
        if (stage === Stage.PRIMARY) {
            baseList = allNames.filter(n => n.toUpperCase().includes('PRI') || n.match(/^[1-6]º.*[A-Z]/) && !n.includes('ESO') && !n.includes('BAC'));
        } else {
            baseList = allNames.filter(n => n.toUpperCase().includes('ESO') || n.toUpperCase().includes('BAC') || n.toUpperCase().includes('SEC'));
        }

        // Fallback si el filtro falla completamente (ej. nombres raros)
        if (baseList.length === 0) {
             baseList = stage === Stage.PRIMARY ? COURSES_PRIMARY : COURSES_SECONDARY;
        }

    } else {
        baseList = stage === Stage.PRIMARY ? COURSES_PRIMARY : COURSES_SECONDARY;
    }

    // APLICAR RESTRICCIONES DE CARRO
    if (stage === Stage.SECONDARY && currentResource === 'CART') {
        // Solo 3º y 4º de ESO para el carro
        return baseList.filter(c => c.startsWith('3º') || c.startsWith('4º'));
    }
    
    // Ordenar alfabéticamente para limpieza
    return baseList.sort();

  }, [stage, currentResource, importedClasses]);

  const roomName = stage === Stage.PRIMARY 
    ? 'Aula de Idiomas' 
    : (currentResource === 'CART' ? 'Carro de Portátiles' : 'Aula de Informática');
  
  const colors = stage === Stage.PRIMARY 
    ? { primary: 'blue', text: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', gradient: 'from-blue-600 to-indigo-600' }
    : { primary: 'emerald', text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', gradient: 'from-emerald-600 to-teal-600' };

  // Reset resource to ROOM when stage changes or for Primary
  useEffect(() => {
    if (stage === Stage.PRIMARY) {
        setCurrentResource('ROOM');
    }
  }, [stage]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        // Cargar Bookings, Profesores y Clases
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
        // Filter by stage AND resource (default to ROOM if undefined in old data)
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
    
    // Si la reserva existente tiene un curso, lo usamos, si no, usamos el primero de la lista filtrada
    // Esto asegura que si estamos en modo carro, por defecto salga un curso válido (3º o 4º)
    const defaultCourse = courses[0] || '';
    setCourse(existing?.course || defaultCourse);
    setSubject(existing?.subject || '');
    
    // Gestión inteligente del selector de profesor para ADMIN
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
      resource: currentResource, // Guardamos si es Aula o Carro
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
    <div className="max-w-screen-2xl mx-auto px-4 py-8 flex flex-col h-[calc(100vh-80px)]">
      {/* Header & Filters */}
      <div className="flex-none flex flex-col gap-4 mb-6">
          <div className="flex flex-col md:flex-row justify-between items-center glass-panel p-4 rounded-3xl gap-4">
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                <div className="flex items-center space-x-4 self-start sm:self-center">
                    <button onClick={onBack} className="p-3 hover:bg-slate-100 rounded-2xl"><ArrowLeft className="h-5 w-5"/></button>
                    <div><h2 className={`text-xl md:text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r ${colors.gradient}`}>{roomName}</h2></div>
                </div>

                {/* Resource Toggle for Secondary */}
                {stage === Stage.SECONDARY && (
                    <div className="flex bg-slate-100/80 p-1 rounded-xl">
                        <button 
                            onClick={() => setCurrentResource('ROOM')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${currentResource === 'ROOM' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <Monitor className="w-4 h-4" />
                            <span className="hidden sm:inline">Aula Info</span>
                        </button>
                        <button 
                            onClick={() => setCurrentResource('CART')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${currentResource === 'CART' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <Laptop className="w-4 h-4" />
                            <span className="hidden sm:inline">Carro Portátiles</span>
                        </button>
                    </div>
                )}
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto justify-end">
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
                    const booking = filteredBookings.find(b => b.date === formatDate(day) && b.slotId === slot.id);
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
                    <div className="mt-2 text-[10px] bg-slate-200 inline-block px-2 py-0.5 rounded text-slate-600 font-bold">
                        {existingBooking.resource === 'CART' ? 'Carro Portátiles' : 'Aula Informática'}
                    </div>
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
                
                {/* Info del recurso actual */}
                <div className="text-center text-xs font-bold text-slate-400 bg-slate-50 p-2 rounded-lg border border-dashed border-slate-200">
                    Reservando en: <span className="text-slate-700 uppercase">{currentResource === 'CART' ? 'Carro de Portátiles' : 'Aula Estándar'}</span>
                </div>

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
                                {stage === Stage.SECONDARY && currentResource === 'CART' && (
                                    <p className="text-[10px] text-amber-600 mt-1 font-bold">* Limitado a 3º y 4º ESO</p>
                                )}
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