import { format, isWeekend, startOfWeek, endOfWeek, eachDayOfInterval, getYear, getMonth, getDate } from 'date-fns';
import { es } from 'date-fns/locale';

export const formatDate = (date: Date): string => {
  return format(date, 'yyyy-MM-dd');
};

export const formatDisplayDate = (date: Date): string => {
  return format(date, "EEEE, d 'de' MMMM", { locale: es });
};

// Calendario Escolar Huelva - Actualizado Curso 2025/2026 según imagen
const HOLIDAYS = [
  // --- FINALES 2024 / CURSO 2024-25 (Compatibilidad actual) ---
  '2024-10-12', // Hispanidad
  '2024-11-01', // Todos los Santos
  '2024-12-06', // Constitución
  '2024-12-08', // Inmaculada
  '2024-12-25', // Navidad
  '2025-01-01', // Año Nuevo
  '2025-01-06', // Reyes
  '2025-02-28', // Día de Andalucía
  '2025-05-01', // Trabajo
  
  // --- CURSO 2025-2026 (Según imagen adjunta) ---
  '2025-10-13', // Día de la Hispanidad (Traslado o Festivo) - Imagen dice día 13 festivo por Hispanidad
  '2025-10-14', // No lectivo Huelva ciudad
  '2025-11-01', // Todos los Santos
  '2025-12-06', // Constitución
  '2025-12-08', // Inmaculada
  '2025-12-25', // Navidad
  '2026-01-01', // Año Nuevo
  '2026-01-06', // Epifanía
  '2026-02-27', // Día de la Comunidad Educativa (No lectivo provincial)
  '2026-02-28', // Día de Andalucía
  '2026-05-01', // Día del Trabajo
  '2026-05-21', // No lectivo Huelva (Rocio)
  '2026-05-22', // No lectivo Huelva (Rocio)
  '2026-05-25', // No lectivo Huelva (Rocio)
];

// Periodos vacacionales (rangos inclusivos)
const VACATIONS = [
  // Curso 24/25
  { start: '2024-12-23', end: '2025-01-07' }, // Navidad 24
  { start: '2025-04-14', end: '2025-04-20' }, // Semana Santa 25
  { start: '2025-06-24', end: '2025-09-09' }, // Verano 25 (Aprox)

  // Curso 25/26 (Según imagen)
  { start: '2025-12-23', end: '2026-01-06' }, // Navidad 25/26
  { start: '2026-03-30', end: '2026-04-05' }, // Semana Santa 26 (Marzo/Abril)
  { start: '2026-06-23', end: '2026-09-10' }, // Verano 26
];

export const isBookableDay = (date: Date): boolean => {
  if (isWeekend(date)) return false;
  
  const dateString = formatDate(date);
  
  // Check specific holidays
  if (HOLIDAYS.includes(dateString)) return false;
  
  // Check vacation ranges
  for (const range of VACATIONS) {
    if (dateString >= range.start && dateString <= range.end) {
      return false;
    }
  }
  
  return true;
};

export const getWeekDays = (currentDate: Date): Date[] => {
  const start = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday
  const end = endOfWeek(currentDate, { weekStartsOn: 1 });
  
  return eachDayOfInterval({ start, end });
};