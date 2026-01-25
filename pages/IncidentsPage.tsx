import React, { useEffect, useState } from 'react';
import { Incident } from '../types';
import { CheckCircle, Circle, Monitor, User, Calendar, AlertTriangle, FileText, ArrowLeft, Mail } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { io } from 'socket.io-client';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface IncidentsPageProps {
  onBack?: () => void;
}

export const IncidentsPage: React.FC<IncidentsPageProps> = ({ onBack }) => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingReport, setSendingReport] = useState(false);

  const fetchIncidents = async () => {
    try {
      const res = await fetch('/api/incidents');
      const data = await res.json();
      if (Array.isArray(data)) {
        setIncidents(data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
    const socket = io();

    socket.on('server:incidents_updated', (data: Incident[]) => {
        setIncidents(data.sort((a,b) => b.timestamp - a.timestamp));
    });

    return () => {
        socket.disconnect();
    };
  }, []);

  const toggleResolved = async (incident: Incident) => {
    try {
      // Optimistic update
      setIncidents(prev => prev.map(i => i.id === incident.id ? { ...i, isResolved: !i.isResolved } : i));

      await fetch(`/api/incidents/${incident.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isResolved: !incident.isResolved })
      });
    } catch (e) {
      console.error(e);
      alert('Error actualizando estado');
      fetchIncidents(); // Revert on error
    }
  };

  // Group by date
  const grouped = incidents.reduce((acc, incident) => {
    const dateKey = format(new Date(incident.timestamp), 'yyyy-MM-dd');
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(incident);
    return acc;
  }, {} as Record<string, Incident[]>);

  const sortedDates = Object.keys(grouped).sort().reverse();

  const generatePDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text('Registro de Incidencias TIC', 14, 20);
    doc.setFontSize(10);
    doc.text(`Fecha informe: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 28);

    const tableData = incidents.map(inc => [
      inc.resource,
      inc.pcNumber || '-',
      inc.description,
      inc.teacherName,
      format(new Date(inc.timestamp), 'dd/MM/yyyy HH:mm'),
      inc.isResolved ? 'Resuelto' : 'Pendiente'
    ]);

    autoTable(doc, {
      startY: 35,
      head: [['Recurso', 'PC', 'Descripción', 'Profesor', 'Fecha/Hora', 'Estado']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [41, 55, 75] }, // Dark slate
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        2: { cellWidth: 70 } // Description wider
      }
    });

    doc.save('incidencias-tic.pdf');
  };

  const sendReport = async () => {
    if (!confirm('¿Estás seguro de que quieres enviar el reporte de incidencias por email?')) return;

    setSendingReport(true);
    try {
      const res = await fetch('/api/admin/test-email');
      const data = await res.json();
      if (data.success) {
        alert('Reporte enviado correctamente.');
      } else {
        alert('Error enviando el reporte: ' + (data.error || 'Desconocido'));
      }
    } catch (e) {
      console.error(e);
      alert('Error de conexión al enviar el reporte.');
    } finally {
      setSendingReport(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Cargando incidencias...</div>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {onBack && (
        <button
          onClick={onBack}
          className="mb-4 flex items-center gap-2 text-slate-500 hover:text-slate-700 font-medium transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Volver</span>
        </button>
      )}
      <div className="flex justify-between items-center mb-8">
        <div>
           <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
             <AlertTriangle className="text-red-500" />
             Registro de Incidencias
           </h1>
           <p className="text-slate-500 text-sm mt-1">Gestión y seguimiento de problemas técnicos.</p>
        </div>
        <div className="flex gap-2">
           <button
             onClick={sendReport}
             disabled={sendingReport}
             className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 transition-colors font-medium shadow-lg shadow-emerald-900/10 disabled:opacity-50 disabled:cursor-not-allowed"
           >
             <Mail className="w-4 h-4" />
             <span>{sendingReport ? 'Enviando...' : 'Enviar Reporte'}</span>
           </button>
           <button
             onClick={generatePDF}
             className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition-colors font-medium shadow-lg shadow-slate-900/10"
           >
             <FileText className="w-4 h-4" />
             <span>Imprimir PDF</span>
           </button>
        </div>
      </div>

      <div className="space-y-8">
        {sortedDates.map(date => (
          <div key={date}>
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {format(new Date(date), "EEEE, d 'de' MMMM", { locale: es })}
            </h3>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {grouped[date].map((incident, idx) => (
                    <div key={incident.id} className={`p-4 flex items-start gap-4 ${idx !== grouped[date].length - 1 ? 'border-b border-slate-100' : ''} hover:bg-slate-50 transition-colors`}>
                        {/* Status Toggle */}
                        <button
                            onClick={() => toggleResolved(incident)}
                            className={`flex-shrink-0 mt-1 transition-colors ${incident.isResolved ? 'text-emerald-500' : 'text-slate-300 hover:text-emerald-500'}`}
                            title={incident.isResolved ? "Marcar como pendiente" : "Marcar como resuelto"}
                        >
                            {incident.isResolved ? <CheckCircle className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
                        </button>

                        <div className="flex-grow">
                            <div className="flex justify-between items-start mb-1">
                                <div className="flex items-center gap-2">
                                    <span className={`px-2 py-0.5 rounded-md text-xs font-bold border ${incident.resource === 'AULA' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                                        {incident.resource}
                                    </span>
                                    {incident.pcNumber && (
                                        <span className="flex items-center gap-1 text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                                            <Monitor className="w-3 h-3" />
                                            PC {incident.pcNumber}
                                        </span>
                                    )}
                                </div>
                                <span className="text-xs text-slate-400 font-mono">
                                    {format(new Date(incident.timestamp), 'HH:mm')}
                                </span>
                            </div>

                            <p className={`text-sm ${incident.isResolved ? 'text-slate-500 line-through' : 'text-slate-800 font-medium'}`}>
                                {incident.description}
                            </p>

                            <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                                <User className="w-3 h-3" />
                                <span>{incident.teacherName}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
          </div>
        ))}

        {sortedDates.length === 0 && (
            <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300 text-slate-400">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 text-emerald-100" />
                <p>No hay incidencias registradas.</p>
            </div>
        )}
      </div>
    </div>
  );
};
