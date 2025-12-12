import { Booking, Stage } from '../types';

// Helper to determine API URL
const API_URL = '/api/bookings';
const LOCAL_STORAGE_KEY = 'hispanidad_bookings';

export const getBookings = async (): Promise<Booking[]> => {
  try {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.warn('API no disponible, usando almacenamiento local (LocalStorage).', error);
    const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
    return localData ? JSON.parse(localData) : [];
  }
};

export const saveBooking = async (booking: Booking): Promise<void> => {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(booking),
    });
    if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
    }
  } catch (error) {
    console.warn('API no disponible, guardando en local.', error);
    // Local Fallback
    const currentBookings = await getBookings();
    currentBookings.push(booking);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(currentBookings));
  }
};

export const removeBooking = async (bookingId: string): Promise<void> => {
  try {
    const response = await fetch(`${API_URL}/${bookingId}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete booking on server');
  } catch (error) {
    console.warn('API no disponible, eliminando en local.', error);
    // Local Fallback
    const currentBookings = await getBookings();
    const updatedBookings = currentBookings.filter(b => b.id !== bookingId);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedBookings));
  }
};

// Filter helper (runs client side after fetching all, or could be API param)
export const getBookingsForDateAndStage = (bookings: Booking[], date: string, stage: Stage): Booking[] => {
  return bookings.filter(b => b.date === date && b.stage === stage);
};