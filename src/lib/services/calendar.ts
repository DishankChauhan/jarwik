// @ts-nocheck
import { google } from 'googleapis';

export interface CalendarService {
  createEvent: (event: CalendarEventInput) => Promise<CalendarEvent | null>;
  getEvents: (timeMin?: Date, timeMax?: Date) => Promise<CalendarEvent[]>;
  updateEvent: (eventId: string, updates: Partial<CalendarEventInput>) => Promise<boolean>;
  deleteEvent: (eventId: string) => Promise<boolean>;
  findFreeTime: (duration: number, timeMin?: Date, timeMax?: Date) => Promise<Date[]>;
  scheduleWithContact: (contactEmail: string, title: string, duration: number, preferredTimes?: Date[]) => Promise<CalendarEvent | null>;
}

export interface CalendarEventInput {
  title: string;
  description?: string;
  start: Date;
  end: Date;
  attendees?: string[];
  location?: string;
  reminders?: {
    useDefault: boolean;
    overrides?: { method: string; minutes: number }[];
  };
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: Date;
  end: Date;
  attendees?: { email: string; responseStatus: string }[];
  location?: string;
  creator: string;
  organizer: string;
  status: string;
  htmlLink: string;
}

class CalendarServiceImpl implements CalendarService {
  private calendar: unknown = null;
  private isInitialized = false;

  constructor() {
    this.initializeCalendar();
  }

  private async initializeCalendar() {
    try {
      // Use API key for simpler setup (read-only access)
      this.calendar = google.calendar({ 
        version: 'v3', 
        auth: process.env.GOOGLE_API_KEY 
      });
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize Calendar service:', error);
    }
  }

  private async ensureInitialized() {
    if (!this.isInitialized) {
      await this.initializeCalendar();
    }
    if (!this.isInitialized) {
      throw new Error('Calendar service not initialized');
    }
  }

  async createEvent(eventInput: CalendarEventInput): Promise<CalendarEvent | null> {
    try {
      await this.ensureInitialized();

      const event = {
        summary: eventInput.title,
        description: eventInput.description,
        start: {
          dateTime: eventInput.start.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        end: {
          dateTime: eventInput.end.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        attendees: eventInput.attendees?.map(email => ({ email })),
        location: eventInput.location,
        reminders: eventInput.reminders || {
          useDefault: true,
        },
      };

      const response = await this.calendar.events.insert({
        calendarId: 'primary',
        resource: event,
        sendUpdates: 'all',
      });

      return this.parseCalendarEvent((response as { data: unknown }).data);
    } catch (error) {
      console.error('Failed to create calendar event:', error);
      return null;
    }
  }

  async getEvents(timeMin?: Date, timeMax?: Date): Promise<CalendarEvent[]> {
    try {
      await this.ensureInitialized();

      const now = new Date();
      const response = await this.calendar.events.list({
        calendarId: 'primary',
        timeMin: (timeMin || now).toISOString(),
        timeMax: (timeMax || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)).toISOString(),
        maxResults: 50,
        singleEvents: true,
        orderBy: 'startTime',
      });

      return (response.data as { items?: unknown[] }).items?.map((item: unknown) => this.parseCalendarEvent(item)).filter((event): event is CalendarEvent => event !== null) || [];
    } catch (error) {
      console.error('Failed to get calendar events:', error);
      return [];
    }
  }

  async updateEvent(eventId: string, updates: Partial<CalendarEventInput>): Promise<boolean> {
    try {
      await this.ensureInitialized();

      const updateData: unknown = {};
      
      if (updates.title) updateData.summary = updates.title;
      if (updates.description) updateData.description = updates.description;
      if (updates.location) updateData.location = updates.location;
      if (updates.attendees) updateData.attendees = updates.attendees.map(email => ({ email }));
      
      if (updates.start) {
        updateData.start = {
          dateTime: updates.start.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
      }
      
      if (updates.end) {
        updateData.end = {
          dateTime: updates.end.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
      }

      const response = await this.calendar.events.patch({
        calendarId: 'primary',
        eventId,
        resource: updateData,
        sendUpdates: 'all',
      });

      return !!((response as { data: { id?: string } }).data.id);
    } catch (error) {
      console.error('Failed to update calendar event:', error);
      return false;
    }
  }

  async deleteEvent(eventId: string): Promise<boolean> {
    try {
      await this.ensureInitialized();

      await this.calendar.events.delete({
        calendarId: 'primary',
        eventId,
        sendUpdates: 'all',
      });

      return true;
    } catch (error) {
      console.error('Failed to delete calendar event:', error);
      return false;
    }
  }

  async findFreeTime(duration: number, timeMin?: Date, timeMax?: Date): Promise<Date[]> {
    try {
      const events = await this.getEvents(timeMin, timeMax);
      const freeTimes: Date[] = [];
      
      const startTime = timeMin || new Date();
      const endTime = timeMax || new Date(startTime.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      // Simple algorithm to find free slots (9 AM to 6 PM, weekdays)
      const current = new Date(startTime);
      current.setHours(9, 0, 0, 0);
      
      while (current < endTime) {
        // Skip weekends
        if (current.getDay() === 0 || current.getDay() === 6) {
          current.setDate(current.getDate() + 1);
          current.setHours(9, 0, 0, 0);
          continue;
        }
        
        const slotEnd = new Date(current.getTime() + duration * 60 * 1000);
        
        // Check if this slot conflicts with any existing event
        const hasConflict = events.some(event => {
          return (current < event.end && slotEnd > event.start);
        });
        
        if (!hasConflict && current.getHours() < 18) {
          freeTimes.push(new Date(current));
        }
        
        // Move to next 30-minute slot
        current.setTime(current.getTime() + 30 * 60 * 1000);
        
        // If past 6 PM, move to next day at 9 AM
        if (current.getHours() >= 18) {
          current.setDate(current.getDate() + 1);
          current.setHours(9, 0, 0, 0);
        }
      }
      
      return freeTimes.slice(0, 10); // Return top 10 free slots
    } catch (error) {
      console.error('Failed to find free time:', error);
      return [];
    }
  }

  async scheduleWithContact(
    contactEmail: string, 
    title: string, 
    duration: number, 
    preferredTimes?: Date[]
  ): Promise<CalendarEvent | null> {
    try {
      let startTime: Date;
      
      if (preferredTimes && preferredTimes.length > 0) {
        // Try preferred times first
        const freeTimes = await this.findFreeTime(duration);
        const availablePreferredTime = preferredTimes.find(time =>
          freeTimes.some(freeTime => Math.abs(freeTime.getTime() - time.getTime()) < 30 * 60 * 1000)
        );
        
        startTime = availablePreferredTime || preferredTimes[0];
      } else {
        // Find next available slot
        const freeTimes = await this.findFreeTime(duration);
        if (freeTimes.length === 0) {
          throw new Error('No free time slots available');
        }
        startTime = freeTimes[0];
      }
      
      const endTime = new Date(startTime.getTime() + duration * 60 * 1000);
      
      return await this.createEvent({
        title,
        start: startTime,
        end: endTime,
        attendees: [contactEmail],
        description: `Meeting scheduled with ${contactEmail}`,
      });
    } catch (error) {
      console.error('Failed to schedule with contact:', error);
      return null;
    }
  }

  private parseCalendarEvent(eventData: unknown): CalendarEvent | null {
    try {
      return {
        id: eventData.id,
        title: eventData.summary || 'Untitled Event',
        description: eventData.description,
        start: new Date(eventData.start?.dateTime || eventData.start?.date),
        end: new Date(eventData.end?.dateTime || eventData.end?.date),
        attendees: eventData.attendees?.map((attendee: unknown) => ({
          email: attendee.email,
          responseStatus: attendee.responseStatus,
        })),
        location: eventData.location,
        creator: eventData.creator?.email || '',
        organizer: eventData.organizer?.email || '',
        status: eventData.status,
        htmlLink: eventData.htmlLink,
      };
    } catch (error) {
      console.error('Failed to parse calendar event:', error);
      return null;
    }
  }
}

// Export singleton instance
export const calendarService = new CalendarServiceImpl();
