import { useState, useCallback } from 'react';
import type { CalendarEvent, CalendarEventInput } from '@/lib/services';

export function useCalendar() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createEvent = useCallback(async (eventData: CalendarEventInput) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'create', 
          ...eventData,
          start: eventData.start.toISOString(),
          end: eventData.end.toISOString(),
        }),
      });
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }
      
      return data.data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create event');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const getEvents = useCallback(async (timeMin?: Date, timeMax?: Date): Promise<CalendarEvent[]> => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (timeMin) params.append('timeMin', timeMin.toISOString());
      if (timeMax) params.append('timeMax', timeMax.toISOString());
      
      const response = await fetch(`/api/calendar?${params}`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error);
      }
      
      return data.data.map((event: any) => ({
        ...event,
        start: new Date(event.start),
        end: new Date(event.end),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch events');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const updateEvent = useCallback(async (eventId: string, updates: Partial<CalendarEventInput>) => {
    setLoading(true);
    setError(null);
    try {
      const updateData: any = { ...updates };
      if (updateData.start) updateData.start = updateData.start.toISOString();
      if (updateData.end) updateData.end = updateData.end.toISOString();
      
      const response = await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', eventId, ...updateData }),
      });
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }
      
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update event');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteEvent = useCallback(async (eventId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', eventId }),
      });
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }
      
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete event');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const findFreeTime = useCallback(async (duration: number, timeMin?: Date, timeMax?: Date): Promise<Date[]> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'findFreeTime', 
          duration,
          timeMin: timeMin?.toISOString(),
          timeMax: timeMax?.toISOString(),
        }),
      });
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }
      
      return data.data.map((time: string) => new Date(time));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to find free time');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const scheduleWithContact = useCallback(async (
    contactEmail: string, 
    title: string, 
    duration: number, 
    preferredTimes?: Date[]
  ) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'scheduleWithContact', 
          contactEmail,
          title,
          duration,
          preferredTimes: preferredTimes?.map(time => time.toISOString()),
        }),
      });
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }
      
      return data.data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule meeting');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    createEvent,
    getEvents,
    updateEvent,
    deleteEvent,
    findFreeTime,
    scheduleWithContact,
    loading,
    error,
  };
}
