import React, { useState } from 'react';
import { Modal } from './Modal';
import { User, Incident } from '../types';

interface IncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
}

export const IncidentModal: React.FC<IncidentModalProps> = ({ isOpen, onClose, user }) => {
  const [resource, setResource] = useState('AULA');
  const [pcNumber, setPcNumber] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const newIncident: Partial<Incident> = {
      description,
      resource,
      pcNumber: pcNumber || undefined,
      teacherEmail: user.email,
      teacherName: user.name,
      isResolved: false
    };

    try {
      const res = await fetch('http://localhost:3001/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newIncident)
      });

      if (res.ok) {
        // Reset and close
        setResource('AULA');
        setPcNumber('');
        setDescription('');
        onClose();
        alert('Incidencia registrada correctamente');
      } else {
        alert('Error al registrar incidencia');
      }
    } catch (error) {
      console.error(error);
      alert('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reportar Incidencia">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Recurso Afectado</label>
          <select
            value={resource}
            onChange={(e) => setResource(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="AULA">Aula de Informática</option>
            <option value="CARRO">Carro de Portátiles</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Nº de Ordenador (Opcional)</label>
          <input
            type="text"
            value={pcNumber}
            onChange={(e) => setPcNumber(e.target.value)}
            placeholder="Ej: 15"
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Descripción del Problema</label>
          <textarea
            required
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe qué ocurre..."
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
          />
        </div>

        <div className="flex justify-end pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-500 hover:text-slate-700 font-medium text-sm mr-3"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-red-500/20 transition-all disabled:opacity-50"
          >
            {loading ? 'Enviando...' : 'Registrar Incidencia'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
