import React, { useState, useEffect } from 'react';
import { Booking, Student, SeatingPlan, ClassGroup, SLOTS_PRIMARY, SLOTS_SECONDARY } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ArrowLeft, User, Shuffle, SortAsc, Save, Printer, FileText, Users } from 'lucide-react';

interface StudentOrganizerProps {
  booking: Booking;
  classes: ClassGroup[];
  onClose: () => void;
  onUpdateBooking: (bookingId: string, seatingPlan: SeatingPlan) => void;
  isAdmin?: boolean;
}

const COMPUTER_COUNT = 30;

export const StudentOrganizer: React.FC<StudentOrganizerProps> = ({ booking, classes, onClose, onUpdateBooking, isAdmin }) => {
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [seatingPlan, setSeatingPlan] = useState<SeatingPlan>(booking.seatingPlan || {});
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isPairMode, setIsPairMode] = useState(false);

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

    if (current.length >= 2) {
        alert("Este ordenador ya tiene 2 alumnos asignados.");
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
        studentsToAssign = studentsToAssign.sort((a, b) => a.name.localeCompare(b.name));
    }

    const newPlan: SeatingPlan = {};
    let studentIndex = 0;

    for (let i = 1; i <= COMPUTER_COUNT; i++) {
        if (studentIndex >= studentsToAssign.length) break;

        const s1 = studentsToAssign[studentIndex];
        studentIndex++;

        let assigned = [s1];

        // If Pair Mode is ON, try to take the next student too
        if (isPairMode && studentIndex < studentsToAssign.length) {
            const s2 = studentsToAssign[studentIndex];
            assigned.push(s2);
            studentIndex++;
        }

        newPlan[i] = assigned;
    }
    setSeatingPlan(newPlan);
  };

  const handleSave = () => {
    onUpdateBooking(booking.id, seatingPlan);
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
    for (let i = 1; i <= COMPUTER_COUNT; i++) {
        const students = seatingPlan[i] || [];
        // If pair, join names
        const names = students.map(s => s.name).join(' / ');
        const classesStr = students.map(s => s.classId).join(' / '); // Or just use one if they are same class

        tableData.push([
            i.toString(),
            names,
            '' // Class column usually redundant if header says Class, but let's leave it blank or fill if mixed?
        ]);
    }

    autoTable(doc, {
        startY: 60,
        head: [['Nº', 'Alumno/s', 'Observaciones']],
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

    const tableData = Array.from({ length: 30 }, (_, i) => [ (i+1).toString(), '', '']);

    autoTable(doc, {
        startY: 75,
        head: [['Nº', 'Alumno', 'Clase']],
        body: tableData,
        theme: 'grid',
        styles: { minCellHeight: 8 }
    });

    doc.save('registro_tic_plantilla.pdf');
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white rounded-lg shadow-xl">
      <div className="bg-blue-600 text-white p-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
            <button onClick={onClose} className="hover:bg-blue-700 p-1 rounded"><ArrowLeft size={20}/></button>
            <h2 className="text-xl font-bold">Organizar Alumnado: {booking.course}</h2>
        </div>
        <div className="flex gap-2">
            <button onClick={() => generatePDF()} className="flex items-center gap-1 bg-white text-blue-600 px-3 py-1 rounded hover:bg-gray-100 text-sm font-medium">
                <Printer size={16}/> Imprimir
            </button>
            {isAdmin && (
                <button onClick={() => generateBlankTemplate()} className="flex items-center gap-1 bg-blue-800 text-white px-3 py-1 rounded hover:bg-blue-900 text-sm font-medium">
                    <FileText size={16}/> Plantilla Vacía
                </button>
            )}
            <button onClick={handleSave} className="flex items-center gap-1 bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 text-sm font-medium">
                <Save size={16}/> Guardar
            </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex">
        <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-gray-700">Ordenadores ({COMPUTER_COUNT})</h3>
                <div className="flex flex-col md:flex-row gap-2 text-sm items-end md:items-center">
                    <div className="flex items-center gap-2 bg-white p-1 px-2 rounded border">
                        <label className="text-gray-600 flex items-center gap-1 cursor-pointer select-none">
                            <input type="checkbox" checked={isPairMode} onChange={e => setIsPairMode(e.target.checked)} className="form-checkbox"/>
                            <Users size={14}/> Por Parejas
                        </label>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => autoAssign('ALPHABETICAL')} className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300 flex items-center gap-1"><SortAsc size={14}/> Alfabetico</button>
                        <button onClick={() => autoAssign('RANDOM')} className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300 flex items-center gap-1"><Shuffle size={14}/> Aleatorio</button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {Array.from({ length: COMPUTER_COUNT }, (_, i) => i + 1).map(num => {
                    const assignedStudents = seatingPlan[num] || [];
                    return (
                        <div
                            key={num}
                            className={`border rounded p-2 h-28 flex flex-col justify-between cursor-pointer transition-colors ${assignedStudents.length > 0 ? 'bg-blue-50 border-blue-300' : 'bg-white hover:bg-gray-100'}`}
                            onClick={() => {
                                if (selectedStudent) {
                                    handleAssign(num, selectedStudent);
                                } else if (assignedStudents.length > 0) {
                                    // Maybe select to unassign one?
                                    // For simplicity, click on non-selected box with content does nothing unless we add 'X' buttons per student
                                }
                            }}
                        >
                            <div className="font-bold text-gray-400 text-sm flex justify-between">
                                <span>PC {num}</span>
                                <span className="text-xs font-normal text-gray-400">{assignedStudents.length}/2</span>
                            </div>
                            <div className="flex-1 flex flex-col justify-center gap-1 overflow-hidden">
                                {assignedStudents.length === 0 ? (
                                    <div className="text-center text-gray-300 italic text-sm">Vacío</div>
                                ) : (
                                    assignedStudents.map(s => (
                                        <div key={s.id} className="text-xs bg-white border rounded px-1 py-0.5 flex justify-between items-center truncate shadow-sm">
                                            <span className="truncate flex-1" title={s.name}>{s.name}</span>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleUnassign(num, s.id); }}
                                                className="ml-1 text-red-400 hover:text-red-600 font-bold"
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

        <div className="w-64 lg:w-80 border-l bg-white flex flex-col">
            <div className="p-3 border-b bg-gray-50">
                <h3 className="font-semibold">Alumnos ({filteredStudents.length})</h3>
                <div className="text-xs text-gray-500">Selecciona un alumno y pulsa en un PC</div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
                {loading ? <div className="p-4 text-center text-gray-500">Cargando...</div> : (
                    filteredStudents.length === 0 ? (
                        <div className="p-4 text-center text-gray-400 italic">Todos asignados.</div>
                    ) : (
                        <div className="space-y-1">
                            {filteredStudents.map(s => (
                                <div
                                    key={s.id}
                                    onClick={() => setSelectedStudent(selectedStudent?.id === s.id ? null : s)}
                                    className={`p-2 rounded cursor-pointer text-sm flex items-center gap-2 ${selectedStudent?.id === s.id ? 'bg-blue-600 text-white' : 'hover:bg-gray-100'}`}
                                >
                                    <User size={14}/>
                                    <span className="truncate">{s.name}</span>
                                </div>
                            ))}
                        </div>
                    )
                )}
            </div>
        </div>
      </div>
    </div>
  );
};
