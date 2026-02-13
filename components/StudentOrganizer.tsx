import React, { useState, useEffect, useMemo } from 'react';
import { Booking, Student, SeatingPlan, ClassGroup, SLOTS_PRIMARY, SLOTS_SECONDARY } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ArrowLeft, User, Shuffle, SortAsc, Save, Printer, FileText, Users, MessageSquare, AlertTriangle, History } from 'lucide-react';
import { Modal } from './Modal';
import { getResourceCapacity } from '../utils/resourceUtils';

interface StudentOrganizerProps {
    booking: Booking;
    classes: ClassGroup[];
    historyBookings?: Booking[];
    onClose: () => void;
    onUpdateBooking: (bookingId: string, seatingPlan: SeatingPlan, incidences: { [key: number]: string }) => void;
    isAdmin?: boolean;
}

const getSortableName = (name: string) => {
    if (name.includes(',')) return name.toLowerCase();
    const parts = name.trim().split(/\s+/);
    if (parts.length < 2) return name.toLowerCase();

    // Heuristic: In Spain, usually 2 surnames. If > 2 words, assume last 2 are surnames.
    // If only 2 words, assume 1 surname.
    let surnames, firstname;
    if (parts.length === 2) {
        surnames = parts[1];
        firstname = parts[0];
    } else {
        surnames = parts.slice(-2).join(' ');
        firstname = parts.slice(0, -2).join(' ');
    }
    return `${surnames}, ${firstname}`.toLowerCase();
};

export const StudentOrganizer: React.FC<StudentOrganizerProps> = ({ booking, classes, historyBookings, onClose, onUpdateBooking, isAdmin }) => {
    const computerCount = getResourceCapacity(booking.stage, booking.resource);
    const [allStudents, setAllStudents] = useState<Student[]>([]);
    const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
    const [seatingPlan, setSeatingPlan] = useState<SeatingPlan>(booking.seatingPlan || {});
    const [incidences, setIncidences] = useState<{ [key: number]: string }>(booking.incidences || {});
    const [loading, setLoading] = useState(true);
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [groupSize, setGroupSize] = useState<number>(1);
    const [activeTab, setActiveTab] = useState<'computers' | 'students'>('computers');

    const isSecondaryCart = booking.stage === 'SECUNDARIA' && booking.resource === 'CART';
    const [showHistoryModal, setShowHistoryModal] = useState(false);

    const previousBookings = useMemo(() => {
        if (!historyBookings) return [];
        return historyBookings.filter(b =>
            b.id !== booking.id &&
            b.teacherEmail === booking.teacherEmail &&
            b.course === booking.course &&
            b.stage === booking.stage &&
            (b.resource || 'ROOM') === (booking.resource || 'ROOM') &&
            b.date < booking.date &&
            b.seatingPlan && Object.keys(b.seatingPlan).length > 0
        ).sort((a, b) => b.date.localeCompare(a.date));
    }, [historyBookings, booking]);

    const handleImportHistory = (prevBooking: Booking) => {
        if (prevBooking.seatingPlan) {
            setSeatingPlan(prevBooking.seatingPlan);
            setShowHistoryModal(false);
        }
    };

    // Incidence Modal State
    const [incidenceModalOpen, setIncidenceModalOpen] = useState(false);
    const [editingIncidenceComputer, setEditingIncidenceComputer] = useState<number | null>(null);
    const [editingIncidenceText, setEditingIncidenceText] = useState('');

    // Load students on mount
    useEffect(() => {
        fetch('/api/students')
            .then(res => res.json())
            .then((data: Student[]) => {
                setAllStudents(data);
                setLoading(false);
            })
            .catch(err => {
                console.error("Error fetching students:", err);
                setLoading(false);
            });
    }, []);

    // Filter students by the booking's class (course)
    useEffect(() => {
        if (!booking.course || allStudents.length === 0) return;

        // Find class ID matching the course name
        const targetClass = classes.find(c => c.name === booking.course);
        let classStudents: Student[] = [];

        if (targetClass) {
            classStudents = allStudents.filter(s => s.classId === targetClass.id);
        } else {
            // Fallback or complex logic if needed
        }

        // Filter out students already assigned
        const assignedIds: string[] = [];
        Object.values(seatingPlan).forEach(students => {
            students.forEach(s => assignedIds.push(s.id));
        });

        const unassigned = classStudents.filter(s => !assignedIds.includes(s.id));

        setFilteredStudents(unassigned);
    }, [allStudents, booking.course, classes, seatingPlan]);


    // --- Logic ---

    const handleAssign = (computerId: number, student: Student) => {
        // Current assignments for this PC
        const current = seatingPlan[computerId] || [];

        // Logic:
        // If we are in pair mode, we allow up to 2 students.
        // If not in pair mode (Manual/Auto single), we usually just replace?
        // Let's assume Manual Assign behaves smartly:
        // If click on empty: Assign.
        // If click on filled: Replace? Or Add if room?
        // Let's allow adding if count < 2.

        if (current.length >= groupSize) {
            alert(`Este ordenador ya tiene ${groupSize} alumnos asignados.`);
            return;
        }

        const newPlan = { ...seatingPlan, [computerId]: [...current, student] };
        setSeatingPlan(newPlan);
        setSelectedStudent(null);
    };

    const handleUnassign = (computerId: number, studentId: string) => {
        const current = seatingPlan[computerId] || [];
        const newStudents = current.filter(s => s.id !== studentId);

        const newPlan = { ...seatingPlan };
        if (newStudents.length > 0) {
            newPlan[computerId] = newStudents;
        } else {
            delete newPlan[computerId];
        }
        setSeatingPlan(newPlan);
    };

    const autoAssign = (mode: 'ALPHABETICAL' | 'RANDOM') => {
        // Find students for this class again (including those currently assigned)
        const targetClass = classes.find(c => c.name === booking.course);
        if (!targetClass) return;
        const classStudents = allStudents.filter(s => s.classId === targetClass.id);

        let studentsToAssign = [...classStudents];

        if (mode === 'RANDOM') {
            studentsToAssign = studentsToAssign.sort(() => Math.random() - 0.5);
        } else {
            studentsToAssign = studentsToAssign.sort((a, b) => getSortableName(a.name).localeCompare(getSortableName(b.name)));
        }

        const newPlan: SeatingPlan = {};
        let studentIndex = 0;

        for (let i = 1; i <= computerCount; i++) {
            if (studentIndex >= studentsToAssign.length) break;

            const s1 = studentsToAssign[studentIndex];
            studentIndex++;

            let assigned = [s1];

            // Fill up to groupSize
            while (assigned.length < groupSize && studentIndex < studentsToAssign.length) {
                assigned.push(studentsToAssign[studentIndex]);
                studentIndex++;
            }

            newPlan[i] = assigned;
        }
        setSeatingPlan(newPlan);
    };

    const openIncidenceModal = (e: React.MouseEvent, computerId: number) => {
        e.stopPropagation();
        setEditingIncidenceComputer(computerId);
        setEditingIncidenceText(incidences[computerId] || '');
        setIncidenceModalOpen(true);
    };

    const saveIncidence = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingIncidenceComputer !== null) {
            const text = editingIncidenceText.trim();
            const newIncidences = { ...incidences };

            if (text) {
                newIncidences[editingIncidenceComputer] = text;

                // Automatically report to global incidents
                const newIncident = {
                    resource: booking.resource === 'CART' ? 'CARRO' : 'AULA',
                    pcNumber: editingIncidenceComputer,
                    description: text,
                    teacherEmail: booking.teacherEmail,
                    teacherName: booking.teacherName,
                    isResolved: false,
                    timestamp: Date.now()
                };

                fetch('/api/incidents', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newIncident)
                }).catch(console.error);

            } else {
                delete newIncidences[editingIncidenceComputer];
            }
            setIncidences(newIncidences);
        }
        setIncidenceModalOpen(false);
    };

    const handleSave = () => {
        onUpdateBooking(booking.id, seatingPlan, incidences);
    };

    // --- PDF Generation ---

    const generatePDF = () => {
        const doc = new jsPDF();
        const logoImg = new Image();
        logoImg.src = '/logo.png';
        logoImg.onload = () => renderPDF(doc, logoImg);
        logoImg.onerror = () => renderPDF(doc, null);
    };

    const renderPDF = (doc: jsPDF, logo: HTMLImageElement | null) => {
        const pageWidth = doc.internal.pageSize.width;

        if (logo) doc.addImage(logo, 'PNG', pageWidth - 40, 10, 30, 30);

        doc.setFontSize(16);
        doc.text('REGISTRO DE USO TIC', 20, 20);

        doc.setFontSize(10);
        doc.text(`Clase: ${booking.course || '-'}`, 20, 30);
        doc.text(`Profesor: ${booking.teacherName}`, 20, 35);

        const slots = booking.stage === 'PRIMARIA' ? SLOTS_PRIMARY : SLOTS_SECONDARY;
        const slot = slots.find(s => s.id === booking.slotId);
        doc.text(`Horario: ${booking.date} (${slot?.label || booking.slotId})`, 20, 40);
        doc.text(`Asignatura: ${booking.subject || '-'}`, 20, 45);
        doc.text(`Actividad: ${booking.justification || '-'}`, 20, 50);

        const tableData = [];
        for (let i = 1; i <= computerCount; i++) {
            const students = seatingPlan[i] || [];
            // If pair, join names
            const names = students.map(s => s.name).join(' / ');
            const incidenceText = incidences[i] || '';

            tableData.push([
                `PC ${i}`,
                names,
                incidenceText
            ]);
        }

        autoTable(doc, {
            startY: 60,
            head: [['PC', 'Alumno/s', 'Observaciones']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [200, 200, 200], textColor: 0 },
            styles: { fontSize: 10 }
        });

        doc.save(`registro_tic_${booking.date}_${booking.course || 'clase'}.pdf`);
    };

    const generateBlankTemplate = () => {
        const doc = new jsPDF();
        const logoImg = new Image();
        logoImg.src = '/logo.png';
        logoImg.onload = () => renderBlankPDF(doc, logoImg);
        logoImg.onerror = () => renderBlankPDF(doc, null);
    };

    const renderBlankPDF = (doc: jsPDF, logo: HTMLImageElement | null) => {
        const pageWidth = doc.internal.pageSize.width;
        if (logo) doc.addImage(logo, 'PNG', pageWidth - 40, 10, 25, 25);

        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text('REGISTRO DE USO TIC', 20, 20);
        doc.setFont("helvetica", "normal");

        doc.setFontSize(10);
        doc.text('Clase: ___________________________', 20, 30);
        doc.text('Fecha/Horario: ___________________', 110, 30);
        doc.text('Profesor: ________________________', 20, 36);
        doc.text('Asignatura: ______________________', 110, 36);
        doc.text('Actividad: __________________________________________________', 20, 42);

        const tableData = Array.from({ length: computerCount }, (_, i) => [`PC ${i + 1}`, '', '']);

        autoTable(doc, {
            startY: 50,
            head: [['PC', 'Alumno/s', 'Observaciones']],
            body: tableData,
            theme: 'grid',
            styles: { minCellHeight: 9 },
            columnStyles: {
                0: { cellWidth: 20 },
                1: { cellWidth: 'auto' },
                2: { cellWidth: 45 }
            }
        });

        doc.save('registro_tic_plantilla.pdf');
    };

    return (
        <div className="flex flex-col h-full overflow-hidden glass-medium rounded-lg shadow-xl">
            <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white p-4 flex justify-between items-center gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <button onClick={onClose} className="hover:bg-white/20 p-1 rounded shrink-0"><ArrowLeft size={20} /></button>
                    <h2 className="text-lg md:text-xl font-bold truncate">Organizar Alumnado: {booking.course}</h2>
                </div>
                <div className="flex gap-2 shrink-0">
                    {previousBookings.length > 0 && (
                        <button onClick={() => setShowHistoryModal(true)} className="flex items-center gap-1 bg-amber-500 text-white px-3 py-1 rounded-lg hover:bg-amber-600 text-sm font-medium shadow-sm">
                            <History size={16} /> <span className="hidden sm:inline">Importar</span>
                        </button>
                    )}
                    <button onClick={() => generatePDF()} className="flex items-center gap-1 bg-white/20 text-white px-3 py-1 rounded-lg hover:bg-white/30 text-sm font-medium">
                        <Printer size={16} /> <span className="hidden sm:inline">Imprimir</span>
                    </button>
                    {isAdmin && (
                        <button onClick={() => generateBlankTemplate()} className="flex items-center gap-1 bg-primary-800 text-white px-3 py-1 rounded-lg hover:bg-primary-900 text-sm font-medium">
                            <FileText size={16} /> <span className="hidden sm:inline">Plantilla Vacía</span>
                        </button>
                    )}
                    <button onClick={handleSave} className="flex items-center gap-1 bg-emerald-500 text-white px-3 py-1 rounded-lg hover:bg-emerald-600 text-sm font-medium shadow-sm">
                        <Save size={16} /> <span>Guardar</span>
                    </button>
                </div>
            </div>

            {/* Mobile Tabs */}
            <div className="md:hidden flex border-b border-glass-border glass-light">
                <button
                    className={`flex-1 py-3 text-sm font-semibold text-center transition-colors ${activeTab === 'computers' ? 'glass-medium border-b-2 border-primary-500 text-primary-600 dark:text-primary-400' : 'text-muted'}`}
                    onClick={() => setActiveTab('computers')}
                >
                    Ordenadores
                </button>
                <button
                    className={`flex-1 py-3 text-sm font-semibold text-center transition-colors ${activeTab === 'students' ? 'glass-medium border-b-2 border-primary-500 text-primary-600 dark:text-primary-400' : 'text-muted'}`}
                    onClick={() => setActiveTab('students')}
                >
                    Alumnos ({filteredStudents.length})
                </button>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                {/* Computer Grid Area */}
                <div className={`flex-1 p-2 md:p-4 overflow-y-auto bg-app ${activeTab === 'computers' ? 'block' : 'hidden md:block'}`}>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-2">
                        <h3 className="font-semibold text-slate-700 dark:text-slate-200 hidden md:block">Ordenadores ({computerCount})</h3>

                        {/* Responsive Toolbar */}
                        <div className="w-full md:w-auto flex flex-wrap gap-2 text-sm">
                            <div className="flex items-center gap-2 glass p-1.5 px-3 rounded-lg shadow-sm">
                                <span className="text-muted flex items-center gap-1"><Users size={16} /> <span className="hidden sm:inline">Agrupación:</span></span>
                                <select
                                    value={groupSize}
                                    onChange={e => setGroupSize(Number(e.target.value))}
                                    className="text-sm border-none bg-transparent focus:ring-0 cursor-pointer outline-none font-medium text-primary-600 dark:text-primary-400"
                                >
                                    <option value={1}>Individual</option>
                                    <option value={2}>Parejas</option>
                                    {isSecondaryCart && <option value={3}>Tríos</option>}
                                </select>
                            </div>
                            <div className="flex gap-2 ml-auto md:ml-0">
                                <button onClick={() => autoAssign('ALPHABETICAL')} className="btn-ghost px-3 py-1.5 text-sm flex items-center gap-1 font-medium"><SortAsc size={16} /> <span>ABC</span></button>
                                <button onClick={() => autoAssign('RANDOM')} className="btn-ghost px-3 py-1.5 text-sm flex items-center gap-1 font-medium"><Shuffle size={16} /> <span>Azar</span></button>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 md:gap-3 pb-20 md:pb-0">
                        {Array.from({ length: computerCount }, (_, i) => i + 1).map(num => {
                            const assignedStudents = seatingPlan[num] || [];
                            const hasIncidence = !!incidences[num];
                            return (
                                <div
                                    key={num}
                                    className={`relative rounded-xl p-2 h-24 md:h-28 flex flex-col justify-between cursor-pointer transition-all active:scale-95 md:active:scale-100 ${assignedStudents.length > 0 ? 'bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 ring-1 ring-primary-200/50 dark:ring-primary-900/30' : 'glass hover:bg-glass-bg shadow-sm'}`}
                                    onClick={() => {
                                        if (selectedStudent) {
                                            handleAssign(num, selectedStudent);
                                        }
                                    }}
                                >
                                    <div className="font-bold text-muted text-sm flex justify-between items-center">
                                        <span>PC {num}</span>
                                        <button
                                            onClick={(e) => openIncidenceModal(e, num)}
                                            className={`p-1 rounded hover:bg-glass-bg transition-colors ${hasIncidence ? 'text-orange-500' : 'text-slate-300 dark:text-slate-600 hover:text-muted'}`}
                                            title={hasIncidence ? incidences[num] : "Añadir incidencia"}
                                        >
                                            {hasIncidence ? <AlertTriangle size={14} fill="currentColor" /> : <MessageSquare size={14} />}
                                        </button>
                                    </div>
                                    <div className="flex-1 flex flex-col justify-center gap-1 overflow-hidden mt-1">
                                        {assignedStudents.length === 0 ? (
                                            <div className="text-center text-slate-300 dark:text-slate-600 italic text-xs md:text-sm">Libre</div>
                                        ) : (
                                            assignedStudents.map(s => (
                                                <div key={s.id} className="text-xs glass rounded px-1 py-0.5 flex justify-between items-center truncate shadow-sm text-slate-800 dark:text-slate-200">
                                                    <span className="truncate flex-1" title={s.name}>{s.name}</span>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleUnassign(num, s.id); }}
                                                        className="ml-1 text-red-400 hover:text-red-600 font-bold p-1 md:p-0"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <Modal isOpen={incidenceModalOpen} onClose={() => setIncidenceModalOpen(false)} title={`Incidencia PC ${editingIncidenceComputer}`}>
                    <form onSubmit={saveIncidence} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Descripción de la incidencia</label>
                            <textarea
                                className="w-full p-3 input-glass"
                                rows={4}
                                placeholder="Ej: El ratón no funciona, pantalla parpadea..."
                                value={editingIncidenceText}
                                onChange={e => setEditingIncidenceText(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setIncidenceModalOpen(false)} className="btn-ghost px-4 py-2 text-sm">Cancelar</button>
                            <button type="submit" className="btn-primary px-4 py-2 text-sm">Guardar Incidencia</button>
                        </div>
                    </form>
                </Modal>
                <Modal isOpen={showHistoryModal} onClose={() => setShowHistoryModal(false)} title="Importar organización anterior" size="md">
                    <div className="space-y-4">
                        <p className="text-sm text-gray-500 dark:text-slate-400">Selecciona una reserva previa para copiar la organización del alumnado.</p>
                        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                            {previousBookings.map(b => {
                                const slots = b.stage === 'PRIMARIA' ? SLOTS_PRIMARY : SLOTS_SECONDARY;
                                const slotLabel = slots.find(s => s.id === b.slotId)?.label || b.slotId;
                                return (
                                    <button
                                        key={b.id}
                                        onClick={() => handleImportHistory(b)}
                                        className="w-full text-left p-3 glass rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:border-primary-200 dark:hover:border-primary-800 transition-colors flex flex-col gap-1"
                                    >
                                        <div className="flex justify-between items-center">
                                            <span className="font-bold text-slate-800 dark:text-white">{b.date}</span>
                                            <span className="text-xs glass px-2 py-0.5 rounded-full text-muted">{slotLabel}</span>
                                        </div>
                                        <div className="text-sm text-gray-600 dark:text-slate-400">{b.subject || 'Sin asignatura'}</div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </Modal>

                {/* Student List Sidebar */}
                <div className={`md:w-64 lg:w-80 border-l border-glass-border glass-light flex flex-col ${activeTab === 'students' ? 'block flex-1' : 'hidden md:flex'}`}>
                    <div className="p-3 border-b border-glass-border glass hidden md:block">
                        <h3 className="font-semibold text-slate-800 dark:text-slate-200 font-display">Alumnos ({filteredStudents.length})</h3>
                        <div className="text-xs text-gray-500 dark:text-slate-400">Selecciona un alumno y pulsa en un PC</div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 pb-20 md:pb-2">
                        {loading ? <div className="p-4 text-center text-gray-500 dark:text-slate-400">Cargando...</div> : (
                            filteredStudents.length === 0 ? (
                                <div className="p-8 text-center text-gray-400 dark:text-slate-600 italic flex flex-col items-center gap-2">
                                    <Users size={32} className="opacity-20" />
                                    <span>Todos asignados</span>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {filteredStudents.map(s => (
                                        <div
                                            key={s.id}
                                            onClick={() => setSelectedStudent(selectedStudent?.id === s.id ? null : s)}
                                            className={`p-3 md:p-2 rounded-lg cursor-pointer text-sm flex items-center gap-3 md:gap-2 transition-colors ${selectedStudent?.id === s.id ? 'bg-primary-600 text-white shadow-md' : 'hover:bg-glass-bg text-slate-700 dark:text-slate-200 border border-transparent'}`}
                                        >
                                            <User size={16} />
                                            <span className="truncate font-medium">{s.name}</span>
                                        </div>
                                    ))}
                                </div>
                            )
                        )}
                    </div>
                    {/* Mobile Hint for Students Tab */}
                    <div className="md:hidden p-3 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs text-center border-t border-glass-border">
                        {selectedStudent ? `Seleccionado: ${selectedStudent.name}. Ve a "Ordenadores" para asignar.` : 'Toca un nombre para seleccionarlo.'}
                    </div>
                </div>
            </div>
        </div>
    );
};
