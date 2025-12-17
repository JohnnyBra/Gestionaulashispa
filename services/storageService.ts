import { Booking, Stage, User, ActionLog } from '../types';

// Helper to determine API URL
const API_URL = '/api/bookings';

export const getBookings = async (): Promise<Booking[]> => {
  const response = await fetch(API_URL);
  if (!response.ok) {
    throw new Error(`Server returned ${response.status}`);
  }
  return await response.json();
};

export const getHistory = async (): Promise<ActionLog[]> => {
    const response = await fetch('/api/history');
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }
    return await response.json();
};

export const saveBooking = async (booking: Booking): Promise<void> => {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(booking),
  });
  
  if (response.status === 409) {
    throw new Error('CONFLICT');
  }

  if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
  }
};

export const saveBatchBookings = async (bookings: Booking[]): Promise<void> => {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bookings),
    });

    if (response.status === 409) {
      throw new Error('CONFLICT');
    }

    if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
    }
  };

export const removeBooking = async (bookingId: string, user: User): Promise<void> => {
  const response = await fetch(`${API_URL}/${bookingId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    // Enviamos el usuario para que el servidor pueda registrar quién eliminó la reserva
    body: JSON.stringify({ user }),
  });
  if (!response.ok) throw new Error('Failed to delete booking on server');
};

// Filter helper (runs client side after fetching all, or could be API param)
export const getBookingsForDateAndStage = (bookings: Booking[], date: string, stage: Stage): Booking[] => {
  return bookings.filter(b => b.date === date && b.stage === stage);
};