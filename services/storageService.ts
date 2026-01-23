import { Booking, Stage, User, ActionLog, ClassGroup } from '../types';

export const getBookings = async (): Promise<Booking[]> => {
  const response = await fetch('/api/bookings');
  return await response.json();
};

export const getHistory = async (): Promise<ActionLog[]> => {
  const response = await fetch('/api/history');
  return await response.json();
};

export const getTeachers = async (): Promise<{name: string, email: string}[]> => {
  const response = await fetch('/api/teachers');
  if (!response.ok) return [];
  return await response.json();
};

export const getClasses = async (): Promise<ClassGroup[]> => {
  const response = await fetch('/api/classes');
  if (!response.ok) return [];
  return await response.json();
};

export const loginExternal = async (credentials: {email: string, password: string}): Promise<any> => {
  // Endpoint Proxy actualizado
  const response = await fetch('/api/proxy/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials)
  });
  return await response.json();
};

export const loginGoogle = async (token: string): Promise<any> => {
  const response = await fetch('/api/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token })
  });
  return await response.json();
};

export const saveBooking = async (booking: Booking): Promise<void> => {
  const response = await fetch('/api/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(booking),
  });
  if (response.status === 409) throw new Error('CONFLICT');
  if (!response.ok) throw new Error('Error al guardar');
};

export const saveBatchBookings = async (bookings: Booking[]): Promise<void> => {
  const response = await fetch('/api/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bookings),
  });
  if (response.status === 409) throw new Error('CONFLICT');
};

export const removeBooking = async (bookingId: string, user: User, deleteSeries: boolean = false): Promise<void> => {
  await fetch(`/api/bookings/${bookingId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user, deleteSeries }),
  });
};