import React, { useState, useEffect, useMemo } from 'react';
import { Stage, User, TimeSlot, Booking, SLOTS_PRIMARY, SLOTS_SECONDARY, COURSES_PRIMARY, COURSES_SECONDARY, Role, ResourceType, ClassGroup, SeatingPlan } from '../types';
import { getBookings, saveBooking, saveBatchBookings, removeBooking, getTeachers, getClasses, requestBookingSwap } from '../services/storageService';
import { formatDate, getWeekDays, isBookableDay } from '../utils/dateUtils';
import { Modal } from '../components/Modal';
import { HistoryModal } from '../components/HistoryModal';
import { StudentOrganizer } from '../components/StudentOrganizer';
import { ChevronLeft, ChevronRight, History, Filter, ArrowLeft, Loader2, Laptop, Monitor, FileSpreadsheet, Users, GraduationCap, School, MailQuestion } from 'lucide-react';
import { addWeeks, subWeeks, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { io } from 'socket.io-client';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getResourceCapacity } from '../utils/resourceUtils';

interface CalendarViewProps {
    stage: Stage;
    user: User;
    onBack: () => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ stage, user, onBack }) => {
    const getInitialDate = () => {
        const now = new Date();
        const day = now.getDay();
        const hours = now.getHours();
        const minutes = now.getMinutes();

        // Si es viernes (5) después de las 14:30, o fin de semana (6, 0), mostramos la semana siguiente
        if ((day === 5 && (hours > 14 || (hours === 14 && minutes >= 30))) || day === 6 || day === 0) {
            const nextWeek = new Date(now);
            nextWeek.setDate(now.getDate() + 3); // Sumamos días suficientes para saltar al lunes de la siguiente semana
            return nextWeek;
        }
        return now;
    };

    const [currentDate, setCurrentDate] = useState(getInitialDate());
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [teachers, setTeachers] = useState<{ name: string, email: string }[]>([]);
    const [importedClasses, setImportedClasses] = useState<ClassGroup[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState<{ date: Date, slot: TimeSlot } | null>(null);
    const [existingBooking, setExistingBooking] = useState<Booking | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [showStudentOrganizer, setShowStudentOrganizer] = useState(false);
    const [currentResource, setCurrentResource] = useState<ResourceType>('ROOM');
    const [teacherFilter, setTeacherFilter] = useState('');
    const [courseFilter, setCourseFilter] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [isSyncingTeachers, setIsSyncingTeachers] = useState(false);
    const [isSyncingStudents, setIsSyncingStudents] = useState(false);

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
    const [isSwapRequestMode, setIsSwapRequestMode] = useState(false);
    const [swapReason, setSwapReason] = useState('');

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
        ? { primary: 'blue', text: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/30', border: 'border-blue-200 dark:border-blue-800', gradient: 'from-blue-600 to-indigo-600' }
        : { primary: 'emerald', text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/30', border: 'border-emerald-200 dark:border-emerald-800', gradient: 'from-emerald-600 to-teal-600' };

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            try {
                const [bData, tData, cData] = await Promise.all([getBookings(), getTeachers(), getClasses()]);
                setBookings(bData);
                setTeachers(tData.sort((a, b) => a.name.localeCompare(b.name)));
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

    const bookingsMap = useMemo(() => {
        const map = new Map<string, Booking>();
        for (const b of filteredBookings) {
            const key = `${b.date}-${b.slotId}`;
            if (!map.has(key)) {
                map.set(key, b);
            }
        }
        return map;
    }, [filteredBookings]);

    const isPastSlot = (day: Date, slot: TimeSlot) => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const checkDay = new Date(day.getFullYear(), day.getMonth(), day.getDate());

        if (checkDay < today) return true;
        if (checkDay > today) return false;

        const [endHour, endMinute] = slot.end.split(':').map(Number);
        const slotEndTime = new Date(today);
        slotEndTime.setHours(endHour, endMinute, 0, 0);

        return now >= slotEndTime;
    };

    const handleSlotClick = (day: Date, slot: TimeSlot) => {
        if (!isBookableDay(day)) return;

        if (user.role !== Role.ADMIN && isPastSlot(day, slot)) {
            alert("No se pueden realizar reservas en el pasado.");
            return;
        }

        const existing = bookingsMap.get(`${formatDate(day)}-${slot.id}`);
        setExistingBooking(existing || null);
        setSelectedSlot({ date: day, slot });
        setCourse(existing?.course || courses[0] || '');
        setSubject(existing?.subject || '');
        setJustification(existing?.justification || '');
        setSelectedTeacherEmail(existing?.teacherEmail || (user.role === Role.ADMIN && teachers.length > 0 ? teachers[0].email : user.email));
        setBlockReason(existing?.justification || '');
        setIsBlocking(existing?.isBlocked || false);
        setShowStudentOrganizer(false);
        setIsSwapRequestMode(false);
        setSwapReason('');
        setIsModalOpen(true);
    };

    const handleSwapRequest = async () => {
        if (!existingBooking || !swapReason.trim()) return;
        if (!confirm("¿Seguro que deseas solicitar el cambio al profesor? Se le enviará un correo.")) return;

        setIsSubmitting(true);
        try {
            const slotLabel = selectedSlot?.slot.label || existingBooking.slotId;
            await requestBookingSwap(existingBooking.id, swapReason, user.email, user.name, slotLabel, roomName);
            alert("Solicitud enviada correctamente.");
            setIsModalOpen(false);
        } catch (e: any) {
            alert(e.message || "Error al enviar solicitud.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdateSeatingPlan = async (bookingId: string, seatingPlan: SeatingPlan, incidences: { [key: number]: string }) => {
        try {
            await fetch(`/api/bookings/${bookingId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ seatingPlan, incidences })
            });
            // Update local state if needed, but socket should handle it.
            // Force close modal or show success?
            // Let's rely on socket update.
            setIsModalOpen(false);
        } catch (e) {
            console.error("Error updating seating plan", e);
            alert("Error al guardar la asignación.");
        }
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
                while (formatDate(loop) <= recurringEndDate) {
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

    const handlePrintClick = () => {
        setShowPrintModal(true);
    };

    const handleSync = async (target: 'TEACHERS' | 'STUDENTS') => {
        if (target === 'TEACHERS') setIsSyncingTeachers(true);
        else setIsSyncingStudents(true);

        try {
            const res = await fetch('/api/admin/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target })
            });
            const data = await res.json();
            if (data.success) {
                alert(data.message || 'Sincronización iniciada.');
            } else {
                alert('Error al iniciar sincronización.');
            }
        } catch (e) {
            console.error("Sync error", e);
            alert('Error de conexión.');
        } finally {
            if (target === 'TEACHERS') setIsSyncingTeachers(false);
            else setIsSyncingStudents(false);
        }
    };

    const printWeeklyReport = () => {
        const doc = new jsPDF();
        const logoImg = new Image();
        logoImg.src = '/logo.png';

        logoImg.onload = () => {
            generateWeeklyPDF(doc, logoImg);
        };
        logoImg.onerror = () => {
            generateWeeklyPDF(doc, null);
        };
    };

    const generateWeeklyPDF = (doc: jsPDF, logo: HTMLImageElement | null) => {
        weekDays.slice(0, 5).forEach((day, index) => {
            if (index > 0) doc.addPage();

            const dayStr = formatDate(day);
            const dailyBookings = filteredBookings.filter(b => b.date === dayStr).sort((a, b) => a.slotId.localeCompare(b.slotId));

            const pageWidth = doc.internal.pageSize.width;
            if (logo) doc.addImage(logo, 'PNG', pageWidth - 40, 10, 30, 30);

            doc.setFontSize(16);
            doc.text(`REGISTRO SEMANAL - ${format(day, 'dd/MM/yyyy')}`, 20, 20);
            doc.setFontSize(12);
            doc.text(roomName, 20, 30);

            const tableData = dailyBookings.map(b => {
                const slot = slots.find(s => s.id === b.slotId) || { label: b.slotId };
                return [
                    slots.find(s => s.id === b.slotId)?.label || b.slotId,
                    b.course || '-',
                    b.teacherName,
                    b.subject || '-',
                    b.justification || '-'
                ];
            });

            if (dailyBookings.length === 0) {
                doc.text("No hay reservas para este día.", 20, 50);
            } else {
                autoTable(doc, {
                    startY: 40,
                    head: [['Horario', 'Clase', 'Profesor', 'Asignatura', 'Actividad']],
                    body: tableData,
                    theme: 'grid',
                    headStyles: { fillColor: [50, 50, 50] }
                });
            }
        });
        doc.save(`registro_semanal_${formatDate(weekDays[0])}.pdf`);
        setShowPrintModal(false);
    };

    const printDetailedDayReport = (targetDate: Date) => {
        const doc = new jsPDF();
        const logoImg = new Image();
        logoImg.src = '/logo.png';

        const dayStr = formatDate(targetDate);
        const dailyBookings = filteredBookings.filter(b => b.date === dayStr).sort((a, b) => a.slotId.localeCompare(b.slotId));

        const render = (logo: any) => {
            const pageWidth = doc.internal.pageSize.width;

            if (dailyBookings.length === 0) {
                if (logo) doc.addImage(logo, 'PNG', pageWidth - 40, 10, 30, 30);
                doc.setFontSize(16);
                doc.text(`REGISTRO DETALLADO - ${format(targetDate, 'dd/MM/yyyy')}`, 20, 20);
                doc.setFontSize(12);
                doc.text("No hay reservas para este día.", 20, 40);
            } else {
                dailyBookings.forEach((booking, index) => {
                    if (index > 0) doc.addPage();

                    if (logo) doc.addImage(logo, 'PNG', pageWidth - 40, 10, 30, 30);
                    doc.setFontSize(16);
                    doc.text(`REGISTRO DETALLADO - ${format(targetDate, 'dd/MM/yyyy')}`, 20, 20);
                    doc.setFontSize(10);
                    doc.text(roomName, 20, 28);

                    const slot = slots.find(s => s.id === booking.slotId) || { label: booking.slotId };

                    // Header info block
                    doc.setFillColor(240, 240, 240);
                    doc.rect(20, 32, pageWidth - 40, 25, 'F');

                    doc.setFontSize(11);
                    doc.setTextColor(0);
                    doc.text(`Horario: ${slot?.label}`, 25, 40);
                    doc.text(`Clase: ${booking.course || '-'}`, 100, 40);
                    doc.text(`Profesor: ${booking.teacherName}`, 25, 48);
                    doc.text(`Asignatura: ${booking.subject || '-'}`, 100, 48);
                    doc.text(`Actividad: ${booking.justification || '-'}`, 25, 54);

                    // Students Table
                    const seatingPlan = booking.seatingPlan || {};
                    const incidences = booking.incidences || {};
                    const tableData: any[] = [];
                    const computerCount = getResourceCapacity(stage, currentResource);

                    for (let i = 1; i <= computerCount; i++) {
                        const students = seatingPlan[i] || [];
                        const incidenceText = incidences[i] || '';

                        if (students.length > 0 || incidenceText) {
                            tableData.push([
                                `PC ${i}`,
                                students.map((s: any) => s.name).join(' / '),
                                incidenceText
                            ]);
                        }
                    }

                    if (tableData.length === 0) {
                        doc.text("(Sin asignación de alumnos)", 20, 65);
                    } else {
                        autoTable(doc, {
                            startY: 60,
                            head: [['PC', 'Alumno/s', 'Observaciones']],
                            body: tableData,
                            theme: 'grid',
                            headStyles: { fillColor: [70, 70, 70] },
                            styles: { fontSize: 10 }
                        });
                    }
                });
            }

            doc.save(`registro_detallado_${dayStr}.pdf`);
            setShowPrintModal(false);
        };

        logoImg.onload = () => render(logoImg);
        logoImg.onerror = () => render(null);
    };

    const printBlankTemplate = () => {
        // Reusing logic via a temporary component instance or just duplicating?
        // Duplicating logic here for global "Blank Template" not tied to a specific booking.
        const doc = new jsPDF();
        const logoImg = new Image();
        logoImg.src = '/logo.png';
        const render = (logo: any) => {
            const pageWidth = doc.internal.pageSize.width;
            if (logo) doc.addImage(logo, 'PNG', pageWidth - 40, 10, 30, 30);
            doc.setFontSize(16);
            doc.text('REGISTRO DE USO TIC', 20, 20);
            doc.setFontSize(11);
            doc.text('Clase: ___________________________', 20, 35);
            doc.text('Profesor: ________________________', 20, 45);
            doc.text('Horario: _________________________', 110, 35);
            doc.text('Fecha: ___________________________', 110, 45);
            doc.text('Asignatura: ______________________', 20, 55);
            doc.text('Actividad: _______________________', 20, 65);
            const computerCount = getResourceCapacity(stage, currentResource);
            const tableData = Array.from({ length: computerCount }, (_, i) => [`PC ${i + 1}`, '', '']);
            autoTable(doc, {
                startY: 75,
                head: [['PC', 'Alumno/s', 'Observaciones']],
                body: tableData,
                theme: 'grid',
                styles: { minCellHeight: 8 }
            });
            doc.save('plantilla_registro_tic.pdf');
        };
        logoImg.onload = () => render(logoImg);
        logoImg.onerror = () => render(null);
    };

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] md:h-[calc(100vh-80px)] w-full max-w-full overflow-hidden px-2 md:px-4 py-2 md:py-8">
            <div className="flex-none flex flex-col gap-3 mb-4 w-full">
                <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center glass-medium p-3 rounded-2xl md:rounded-3xl gap-3 w-full">
                    <div className="flex items-center justify-between w-full lg:w-auto">
                        <div className="flex items-center gap-3">
                            <button onClick={onBack} className="p-2 glass hover:bg-glass-bg rounded-xl text-slate-700 dark:text-slate-200 shadow-sm shrink-0 transition-all duration-200"><ArrowLeft className="h-5 w-5" /></button>
                            <div>
                                <h2 className={`text-base md:text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r ${colors.gradient} leading-tight truncate`}>{roomName}</h2>
                                <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider">{stage}</p>
                            </div>
                        </div>
                        {user.role === Role.ADMIN && (
                            <div className="flex gap-2">
                                <button onClick={() => setIsHistoryOpen(true)} className="p-2 glass text-muted rounded-xl shadow-sm lg:hidden transition-all duration-200 hover:scale-105"><History className="w-5 h-5" /></button>
                                <button onClick={() => setShowFilters(!showFilters)} className={`p-2 rounded-xl border lg:hidden transition-all duration-200 ${showFilters ? 'bg-slate-800 text-white dark:bg-slate-600' : 'glass text-muted'}`}><Filter className="w-5 h-5" /></button>

                                {/* Admin Print Buttons */}
                                <button onClick={handlePrintClick} title="Imprimir Informes" className="p-2 glass rounded-xl shadow-sm text-blue-600 dark:text-blue-400 hover:bg-glass-bg transition-all duration-200 hover:scale-105"><FileSpreadsheet className="w-5 h-5" /></button>
                                <button onClick={printBlankTemplate} title="Imprimir Plantilla Vacía" className="p-2 glass rounded-xl shadow-sm text-green-600 dark:text-green-400 hover:bg-glass-bg transition-all duration-200 hover:scale-105"><Monitor className="w-5 h-5" /></button>

                                {/* Admin Sync Buttons */}
                                <button onClick={() => handleSync('TEACHERS')} disabled={isSyncingTeachers} title="Sincronizar Tutores" className="p-2 glass rounded-xl shadow-sm text-amber-600 dark:text-amber-400 hover:bg-glass-bg transition-all duration-200 hover:scale-105 disabled:opacity-50">
                                    {isSyncingTeachers ? <Loader2 className="w-5 h-5 animate-spin" /> : <School className="w-5 h-5" />}
                                </button>
                                <button onClick={() => handleSync('STUDENTS')} disabled={isSyncingStudents} title="Sincronizar Alumnos" className="p-2 glass rounded-xl shadow-sm text-indigo-600 dark:text-indigo-400 hover:bg-glass-bg transition-all duration-200 hover:scale-105 disabled:opacity-50">
                                    {isSyncingStudents ? <Loader2 className="w-5 h-5 animate-spin" /> : <GraduationCap className="w-5 h-5" />}
                                </button>
                            </div>
                        )}
                    </div>
                    {stage === Stage.SECONDARY && (
                        <div className="grid grid-cols-2 gap-1 glass p-1 rounded-xl">
                            <button onClick={() => setCurrentResource('ROOM')} className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${currentResource === 'ROOM' ? 'glass-medium shadow-sm text-emerald-600 dark:text-emerald-400' : 'text-muted hover:bg-glass-bg'}`}><Monitor className="w-4 h-4" />Aula</button>
                            <button onClick={() => setCurrentResource('CART')} className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${currentResource === 'CART' ? 'glass-medium shadow-sm text-emerald-600 dark:text-emerald-400' : 'text-muted hover:bg-glass-bg'}`}><Laptop className="w-4 h-4" />Carro</button>
                        </div>
                    )}
                    <div className="flex items-center justify-between w-full lg:w-auto space-x-2 glass-light p-1 rounded-xl border border-glass-border">
                        <button onClick={() => setCurrentDate(subWeeks(currentDate, 1))} className="p-2 glass hover:bg-glass-bg rounded-lg shadow-sm text-muted"><ChevronLeft className="w-5 h-5" /></button>
                        <div className="flex-1 text-center"><span className="block text-sm font-bold text-slate-800 dark:text-slate-200 capitalize">{format(weekDays[0], 'MMMM yyyy', { locale: es })}</span></div>
                        <button onClick={() => setCurrentDate(addWeeks(currentDate, 1))} className="p-2 glass hover:bg-glass-bg rounded-lg shadow-sm text-muted"><ChevronRight className="w-5 h-5" /></button>
                    </div>
                </div>
                {user.role === Role.ADMIN && showFilters && (
                    <div className="glass-panel p-3 rounded-2xl flex flex-col md:flex-row gap-3">
                        <input type="text" placeholder="Filtrar profesor..." value={teacherFilter} onChange={e => setTeacherFilter(e.target.value)} className="flex-1 p-2.5 border input-glass rounded-xl text-sm outline-none" />
                        <select value={courseFilter} onChange={e => setCourseFilter(e.target.value)} className="flex-1 p-2.5 border input-glass rounded-xl text-sm outline-none">
                            <option value="">Todos los cursos</option>
                            {courses.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                )}
            </div>

            <div className="flex-1 glass-medium rounded-[1.5rem] overflow-hidden shadow-xl flex flex-col relative">
                <div className="w-full h-full overflow-auto">
                    <div className="min-w-[700px] h-full">
                        <div className="grid grid-cols-[60px_repeat(5,minmax(0,1fr))] md:grid-cols-[100px_repeat(5,minmax(0,1fr))] sticky top-0 z-20 glass-light border-b border-glass-border">
                            <div className="glass-light"></div>
                            {weekDays.slice(0, 5).map(day => (
                                <div key={day.toISOString()} className="p-2 md:p-4 text-center border-r border-glass-border glass">
                                    <div className="text-lg md:text-2xl font-black text-slate-800 dark:text-slate-200">{format(day, 'd')}</div>
                                    <div className="text-[10px] md:text-xs font-bold uppercase text-slate-500 dark:text-slate-400">{format(day, 'EEE', { locale: es })}</div>
                                </div>
                            ))}
                        </div>
                        {slots.map(slot => (
                            <div key={slot.id} className="grid grid-cols-[60px_repeat(5,minmax(0,1fr))] md:grid-cols-[100px_repeat(5,minmax(0,1fr))] border-b border-glass-border">
                                <div className="p-4 flex flex-col items-center justify-center text-[10px] md:text-xs font-bold text-slate-600 dark:text-slate-400 glass border-r border-glass-border">
                                    <span>{slot.start}</span><span className="text-slate-500 dark:text-slate-500">{slot.end}</span>
                                </div>
                                {weekDays.slice(0, 5).map(day => {
                                    const booking = bookingsMap.get(`${formatDate(day)}-${slot.id}`);
                                    const isHoliday = !isBookableDay(day);
                                    const isPast = isPastSlot(day, slot);
                                    const isPastForUser = isPast && user.role !== Role.ADMIN;
                                    const isRestricted = !booking && isPastForUser;

                                    return (
                                        <div key={day.toISOString()}
                                            className={`min-h-[100px] p-2 border-r border-glass-border relative group transition-colors duration-150 ${isRestricted ? 'slot-past' : 'cursor-pointer'} ${booking && isPastForUser ? 'slot-past-booked' : ''}`}
                                            onClick={() => !isRestricted && handleSlotClick(day, slot)}>
                                            {isHoliday ? (
                                                <div className="h-full flex items-center justify-center bg-slate-50/50 dark:bg-slate-900/50 text-[10px] text-slate-300 dark:text-slate-600 font-black uppercase -rotate-6">No Lectivo</div>
                                            ) : booking ? (
                                                <div title={`${booking.course} - ${booking.subject} - ${booking.teacherName}\n${booking.justification}`} className={`w-full h-full rounded-xl p-2 border shadow-sm flex flex-col overflow-hidden ${booking.isBlocked ? 'bg-slate-800 text-white' : colors.bg + ' ' + colors.text}`}>
                                                    <p className="text-[10px] font-black truncate leading-tight w-full">{booking.isBlocked ? 'BLOQUEADO' : booking.course}</p>
                                                    <p className="text-[9px] truncate leading-tight mt-0.5 w-full">{booking.isBlocked ? booking.justification : booking.subject}</p>
                                                    <p className="mt-auto text-[8px] font-bold border-t border-current/10 pt-1 truncate w-full">{booking.teacherName}</p>
                                                </div>
                                            ) : (
                                                !isRestricted && (
                                                    <div className="h-full border border-dashed border-slate-300 rounded-xl group-hover:bg-slate-50 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center text-xl text-slate-300">+</div>
                                                )
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

            <Modal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setShowStudentOrganizer(false); }}
                title={showStudentOrganizer ? '' : (existingBooking ? 'Detalles' : 'Nueva Reserva')}
                size={showStudentOrganizer ? 'full' : 'lg'}
            >
                {showStudentOrganizer && existingBooking ? (
                    <StudentOrganizer
                        booking={existingBooking}
                        classes={importedClasses}
                        historyBookings={bookings}
                        onClose={() => setShowStudentOrganizer(false)}
                        onUpdateBooking={handleUpdateSeatingPlan}
                        isAdmin={user.role === Role.ADMIN}
                    />
                ) : existingBooking ? (
                    <div className="space-y-4">
                        <div className="p-4 glass rounded-xl">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Responsable</p>
                            <p className="font-bold text-slate-900 dark:text-white">{existingBooking.teacherName}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{existingBooking.teacherEmail}</p>
                        </div>
                        {!existingBooking.isBlocked && (
                            <>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-3 glass rounded-xl"><p className="text-[10px] font-bold uppercase text-slate-400">Curso</p><p className="text-sm font-bold text-slate-900 dark:text-white">{existingBooking.course}</p></div>
                                    <div className="p-3 glass rounded-xl"><p className="text-[10px] font-bold uppercase text-slate-400">Asignatura</p><p className="text-sm font-bold text-slate-900 dark:text-white">{existingBooking.subject}</p></div>
                                </div>
                                <div className="p-3 border dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
                                    <p className="text-[10px] font-bold uppercase text-slate-400">Actividad</p>
                                    <p className="text-sm font-bold text-slate-900 dark:text-white">{existingBooking.justification}</p>
                                </div>

                                {(user.role === Role.ADMIN || user.id === existingBooking.teacherEmail || user.email === existingBooking.teacherEmail) && (
                                    <button
                                        onClick={() => setShowStudentOrganizer(true)}
                                        className="w-full py-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl font-bold border border-blue-100 dark:border-blue-800 flex items-center justify-center gap-2 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                                    >
                                        <Users size={20} /> Organizar Alumnado
                                    </button>
                                )}

                                {existingBooking.teacherEmail !== user.email && (
                                    !isSwapRequestMode ? (
                                        <button
                                            onClick={() => setIsSwapRequestMode(true)}
                                            className="w-full py-3 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-xl font-bold border border-amber-100 dark:border-amber-800 flex items-center justify-center gap-2 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                                        >
                                            <MailQuestion size={20} /> Solicitar reserva a {existingBooking.teacherName}
                                        </button>
                                    ) : (
                                        <div className="space-y-2 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-xl border border-amber-100 dark:border-amber-800">
                                            <label className="block text-xs font-bold text-amber-800 dark:text-amber-400 uppercase">Motivo de la solicitud</label>
                                            <textarea
                                                value={swapReason}
                                                onChange={(e) => setSwapReason(e.target.value)}
                                                placeholder={`Hola ${existingBooking.teacherName}, me gustaría usar el aula porque...`}
                                                className="w-full p-3 rounded-lg border border-amber-200 dark:border-amber-700 bg-white dark:bg-slate-900 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                                                rows={3}
                                            />
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setIsSwapRequestMode(false)}
                                                    className="flex-1 py-2 btn-ghost text-sm"
                                                >
                                                    Cancelar
                                                </button>
                                                <button
                                                    onClick={handleSwapRequest}
                                                    disabled={!swapReason.trim() || isSubmitting}
                                                    className="flex-1 py-2 bg-amber-600 text-white rounded-lg font-bold shadow-sm text-sm hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center gap-2"
                                                >
                                                    {isSubmitting ? <Loader2 className="animate-spin w-4 h-4" /> : 'Enviar Solicitud'}
                                                </button>
                                            </div>
                                        </div>
                                    )
                                )}
                            </>
                        )}
                        {(user.role === Role.ADMIN || existingBooking.teacherEmail === user.email) && (
                            <div className="flex gap-2 w-full">
                                <button onClick={async () => { await removeBooking(existingBooking.id, user); setIsModalOpen(false); }} className="flex-1 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl font-bold border border-red-100 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">Eliminar</button>
                                {user.role === Role.ADMIN && (
                                    <button onClick={async () => { await removeBooking(existingBooking.id, user, true); setIsModalOpen(false); }} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold border border-red-700 shadow-lg hover:bg-red-700 transition-colors">Eliminar Serie</button>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    <form onSubmit={handleSaveBooking} className="space-y-4">
                        {user.role === Role.ADMIN && (
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setIsBlocking(!isBlocking)} className={`flex-1 p-3 rounded-xl border font-bold text-[10px] uppercase transition-colors ${isBlocking ? 'bg-slate-800 text-white dark:bg-slate-700' : 'bg-white dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700'}`}>Bloquear</button>
                                <button type="button" onClick={() => setIsRecurring(!isRecurring)} className={`flex-1 p-3 rounded-xl border font-bold text-[10px] uppercase transition-colors ${isRecurring ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 dark:border-slate-700'}`}>Recurrencia</button>
                            </div>
                        )}
                        {!isBlocking ? (
                            <>
                                {user.role === Role.ADMIN && (
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Profesor Responsable</label>
                                        <select value={selectedTeacherEmail} onChange={e => setSelectedTeacherEmail(e.target.value)} className="w-full p-3 input-glass">
                                            {teachers.length === 0 && <option>Cargando lista de tutores...</option>}
                                            {teachers.map(t => <option key={t.email} value={t.email}>{t.name}</option>)}
                                        </select>
                                    </div>
                                )}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Curso</label>
                                        <select value={course} onChange={e => setCourse(e.target.value)} className="w-full p-3 input-glass">
                                            {courses.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Asignatura</label>
                                        <input type="text" required value={subject} onChange={e => setSubject(e.target.value)} className="w-full p-3 input-glass" placeholder="Ej: Matemáticas" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Actividad</label>
                                    <textarea required value={justification} onChange={e => setJustification(e.target.value)} className="w-full p-3 input-glass" rows={2} placeholder="Descripción de la actividad..." />
                                </div>
                            </>
                        ) : (
                            <textarea required value={blockReason} onChange={e => setBlockReason(e.target.value)} placeholder="Motivo del bloqueo..." className="w-full p-4 input-glass" rows={3} />
                        )}
                        {isRecurring && user.role === Role.ADMIN && (
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl">
                                <label className="block text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase mb-1">Fecha fin</label>
                                <input type="date" required value={recurringEndDate} onChange={e => setRecurringEndDate(e.target.value)} className="w-full p-2 bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-lg font-bold text-sm text-slate-900 dark:text-white outline-none" />
                            </div>
                        )}
                        <button type="submit" disabled={isSubmitting} className="w-full btn-primary bg-primary-600 hover:bg-primary-700 justify-center">
                            {isSubmitting ? <Loader2 className="animate-spin w-5 h-5" /> : 'Confirmar Reserva'}
                        </button>
                    </form>
                )}
            </Modal>

            <Modal isOpen={showPrintModal} onClose={() => setShowPrintModal(false)} title="Imprimir Informes" size="md">
                <div className="space-y-4">
                    <button onClick={printWeeklyReport} className="w-full p-4 text-left glass rounded-xl hover:bg-glass-bg transition-all duration-200 flex flex-col gap-1">
                        <span className="font-bold text-lg text-slate-800 dark:text-white">Informe Semanal</span>
                        <span className="text-sm text-muted">Resumen de todas las reservas de la semana actual.</span>
                    </button>
                    <div className="border-t border-glass-border my-2"></div>
                    <div className="space-y-2">
                        <p className="text-sm font-bold text-muted uppercase">Informe Detallado por Día</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {weekDays.slice(0, 5).map(day => (
                                <button
                                    key={day.toISOString()}
                                    onClick={() => printDetailedDayReport(day)}
                                    className="p-2 glass rounded-lg text-sm font-semibold hover:bg-glass-bg transition-all duration-200 text-slate-700 dark:text-slate-300"
                                >
                                    {format(day, 'EEEE d', { locale: es })}
                                </button>
                            ))}
                        </div>
                        <p className="text-xs text-slate-400 italic">Genera un PDF con el listado de alumnos por ordenador.</p>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
