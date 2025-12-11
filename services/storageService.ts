import { Booking, Stage } from '../types';

// Helper to determine API URL
const API_URL = '/api/bookings';

export const getBookings = async (): Promise<Booking[]> => {
  try {
    const response = await fetch(API_URL);
    if (!response.ok) {
      const text = await response.text();
      console.error(`Fetch failed: ${response.status} ${response.statusText}`, text);
      throw new Error(`Failed to fetch bookings: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching bookings:', error);
    return [];
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
        const text = await response.text();
        throw new Error(`Failed to save booking: ${response.status} ${text}`);
    }
  } catch (error) {
    console.error('Error saving booking:', error);
    throw error;
  }
};

export const removeBooking = async (bookingId: string): Promise<void> => {
  try {
    const response = await fetch(`${API_URL}/${bookingId}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete booking');
  } catch (error) {
    console.error('Error deleting booking:', error);
    throw error;
  }
};

// Filter helper (runs client side after fetching all, or could be API param)
export const getBookingsForDateAndStage = (bookings: Booking[], date: string, stage: Stage): Booking[] => {
  return bookings.filter(b => b.date === date && b.stage === stage);
};