import React, { useEffect, useState } from 'react';
import { ActionLog } from '../types';
import { getHistory } from '../services/storageService';
import { X, Search, Filter, Trash2, Lock, PlusCircle, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<ActionLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState<'ALL' | 'CREATED' | 'DELETED' | 'BLOCKED'>('ALL');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await getHistory();
      setLogs(data);
    } catch (err) {
      console.error("Error fetching history", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredLogs = logs.filter(log => {
    const matchesSearch =
      log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesAction = filterAction === 'ALL' || log.action === filterAction;

    return matchesSearch && matchesAction;
  });

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'CREATED': return <PlusCircle className="w-4 h-4 text-emerald-500" />;
      case 'DELETED': return <Trash2 className="w-4 h-4 text-red-500" />;
      case 'BLOCKED': return <Lock className="w-4 h-4 text-slate-800 dark:text-slate-300" />;
      default: return <RefreshCw className="w-4 h-4 text-blue-500" />;
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'CREATED': return 'Reserva Creada';
      case 'DELETED': return 'Eliminada';
      case 'BLOCKED': return 'Bloqueo Admin';
      default: return action;
    }
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

        <div className="inline-block align-bottom glass-medium rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl w-full flex flex-col max-h-[90vh]">

          {/* Header */}
          <div className="glass-light px-6 py-4 border-b border-glass-border flex justify-between items-center shrink-0">
            <div>
              <h3 className="text-xl font-bold font-display text-slate-900 dark:text-white">Historial de Auditoría</h3>
              <p className="text-sm text-muted">Registro completo de acciones en la plataforma.</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-glass-bg transition-colors text-muted hover:text-slate-600 dark:hover:text-slate-200">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Controls */}
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 border-b border-glass-border glass shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
              <input
                type="text"
                placeholder="Buscar por usuario o detalle..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 input-glass"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value as any)}
                className="flex-1 px-3 py-2 select-glass font-medium"
              >
                <option value="ALL">Todas las acciones</option>
                <option value="CREATED">Reservas</option>
                <option value="DELETED">Eliminaciones</option>
                <option value="BLOCKED">Bloqueos</option>
              </select>
              <button onClick={fetchLogs} className="p-2 glass hover:bg-glass-bg rounded-xl transition-colors" title="Refrescar">
                <RefreshCw className={`w-4 h-4 text-muted ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1 p-0">
            <table className="min-w-full divide-y divide-glass-border">
              <thead className="glass-light sticky top-0">
                <tr>
                  <th className="px-6 py-3 text-left text-[10px] font-bold text-muted uppercase tracking-wider">Fecha</th>
                  <th className="px-6 py-3 text-left text-[10px] font-bold text-muted uppercase tracking-wider">Acción</th>
                  <th className="px-6 py-3 text-left text-[10px] font-bold text-muted uppercase tracking-wider">Usuario</th>
                  <th className="px-6 py-3 text-left text-[10px] font-bold text-muted uppercase tracking-wider">Detalles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-glass-border">
                {filteredLogs.map((log, idx) => (
                  <tr key={idx} className="hover:bg-glass-bg transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-muted font-mono">
                      {format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {getActionIcon(log.action)}
                        <span className={`text-xs font-bold ${log.action === 'DELETED' ? 'text-red-600' :
                            log.action === 'BLOCKED' ? 'text-slate-800 dark:text-slate-300' : 'text-emerald-600 dark:text-emerald-400'
                          }`}>
                          {getActionLabel(log.action)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-xs font-bold text-slate-700 dark:text-slate-200">{log.userName}</div>
                      <div className="text-[10px] text-muted">{log.user}</div>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-400 max-w-xs truncate" title={log.details}>
                      {log.details}
                    </td>
                  </tr>
                ))}
                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-muted text-sm">
                      No se encontraron registros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};