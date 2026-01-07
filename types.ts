export enum Stage {
  PRIMARY = 'PRIMARIA',
  SECONDARY = 'SECUNDARIA'
}

export enum Role {
  TEACHER = 'TEACHER',
  ADMIN = 'ADMIN'
}

export type ResourceType = 'ROOM' | 'CART';

export interface User {
  email: string;
  name: string;
  role: Role;
  classId?: string; // Para tutores
}

export interface ClassGroup {
  id: string;
  name: string;
}

export interface TimeSlot {
  id: string;
  label: string;
  start: string; // HH:mm
  end: string;   // HH:mm
}

export interface ActionLog {
  action: 'CREATED' | 'BLOCKED' | 'DELETED';
  user: string; // Email of the user who performed the action
  userName: string;
  timestamp: number;
  details?: string;
}

export interface Booking {
  id: string;
  date: string; // YYYY-MM-DD
  slotId: string;
  stage: Stage;
  resource: ResourceType; // Diferencia entre Aula y Carro
  teacherEmail: string;
  teacherName: string;
  course?: string;
  subject?: string;
  isBlocked: boolean; // For admin blocks
  justification?: string; // For admin blocks
  logs: ActionLog[]; // History of actions
  createdAt: number;
}

// Fallbacks en caso de que la API falle, aunque intentaremos cargar desde Prisma
export const COURSES_PRIMARY = [
  '1ºA Primaria', '1ºB Primaria',
  '2ºA Primaria', '2ºB Primaria',
  '3ºA Primaria', '3ºB Primaria',
  '4ºA Primaria', '4ºB Primaria',
  '5ºA Primaria', '5ºB Primaria',
  '6ºA Primaria', '6ºB Primaria'
];

export const COURSES_SECONDARY = [
  '1ºA Secundaria', '1ºB Secundaria',
  '2ºA Secundaria', '2ºB Secundaria',
  '3ºA Secundaria', '3ºB Secundaria',
  '4º Secundaria'
];

// Time slots definitions
export const SLOTS_PRIMARY: TimeSlot[] = [
  { id: 'p1', label: '9:00 - 10:00', start: '09:00', end: '10:00' },
  { id: 'p2', label: '10:00 - 11:00', start: '10:00', end: '11:00' },
  { id: 'p3', label: '11:30 - 12:30', start: '11:30', end: '12:30' },
  { id: 'p4', label: '12:30 - 14:00', start: '12:30', end: '14:00' },
];

export const SLOTS_SECONDARY: TimeSlot[] = [
  { id: 's1', label: '8:00 - 9:00', start: '08:00', end: '09:00' },
  { id: 's2', label: '9:00 - 10:00', start: '09:00', end: '10:00' },
  { id: 's3', label: '10:00 - 11:00', start: '10:00', end: '11:00' },
  { id: 's4', label: '11:30 - 12:30', start: '11:30', end: '12:30' },
  { id: 's5', label: '12:30 - 13:30', start: '12:30', end: '13:30' },
  { id: 's6', label: '13:30 - 14:30', start: '13:30', end: '14:30' },
];