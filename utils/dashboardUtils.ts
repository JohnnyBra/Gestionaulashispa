import { Booking, Stage, User, SLOTS_PRIMARY, SLOTS_SECONDARY, TimeSlot, ResourceType } from '../types';
import { isBookableDay, formatDate, formatDisplayDate } from './dateUtils';
import { addDays, isSameDay, parse, isAfter } from 'date-fns';
import { es } from 'date-fns/locale';

export const getUserUpcomingBookings = (bookings: Booking[], user: User): Booking[] => {
  const now = new Date();
  const todayStr = formatDate(now);
  const nowTime = now.getHours() * 60 + now.getMinutes();

  return bookings
    .filter(b => {
      if (b.teacherEmail !== user.email) return false;

      // Filter out past dates
      if (b.date < todayStr) return false;

      // If today, check time (optional, but good for "upcoming")
      // But keeping it simple: just date >= today is usually enough,
      // maybe filter out passed slots if we want to be precise.
      // Let's just return date >= today.
      return true;
    })
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.slotId.localeCompare(b.slotId);
    })
    .slice(0, 4);
};

export const getFreeSlots = (bookings: Booking[], stage: Stage): string => {
  const slots = stage === Stage.PRIMARY ? SLOTS_PRIMARY : SLOTS_SECONDARY;
  // For Secondary, we track Room and Cart separately?
  // The prompt asks for "huecos libres por aula".
  // If Secondary, we usually care about the Room (Aula).
  // The Cart is a separate resource.
  // I'll produce a string like: "Aula: Lun 12 (9:00, 10:00) | Carro: ..." or just mix them?
  // "Aula Lun 12 9:00... | Carro Lun 12..."
  // Let's generate a combined string if Secondary.

  const resources: ResourceType[] = stage === Stage.PRIMARY ? ['ROOM'] : ['ROOM', 'CART'];
  let resultParts: string[] = [];

  const now = new Date();
  let checkedDays = 0;
  let currentDate = now;

  // Limits
  const MAX_DAYS = 5;

  while (checkedDays < MAX_DAYS) {
    if (isBookableDay(currentDate)) {
      const dateStr = formatDate(currentDate);
      const displayDate = formatDisplayDate(currentDate).split(',')[0] + ' ' + currentDate.getDate(); // "lunes 12"

      resources.forEach(res => {
        const resLabel = stage === Stage.PRIMARY ? '' : (res === 'ROOM' ? 'Aula' : 'Carro');

        // Find free slots
        const freeTimeSlots = slots.filter(slot => {
          // Check if passed (if today)
          if (isSameDay(currentDate, now)) {
             const [endH, endM] = slot.end.split(':').map(Number);
             const slotEnd = new Date(now);
             slotEnd.setHours(endH, endM, 0, 0);
             if (now >= slotEnd) return false;
          }

          // Check if booked
          // Note: In this system, 1 booking = Occupied.
          // We don't check capacity here based on previous analysis (CalendarView checks existence).
          const isBooked = bookings.some(b =>
            b.date === dateStr &&
            b.slotId === slot.id &&
            b.stage === stage &&
            (b.resource || 'ROOM') === res
          );

          return !isBooked;
        });

        if (freeTimeSlots.length > 0) {
          const times = freeTimeSlots.map(s => s.start).join(', ');
          const prefix = resLabel ? `${resLabel} ${displayDate}` : `${displayDate}`;
          resultParts.push(`${prefix} (${times})`);
        }
      });

      checkedDays++;
    }
    currentDate = addDays(currentDate, 1);
  }

  if (resultParts.length === 0) return "No hay huecos libres próximos.";
  return resultParts.join('  •  ');
};
