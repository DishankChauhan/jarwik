import { google } from 'googleapis';
import { userAuthService } from '@/lib/auth/user-auth';
import { googleOAuthService } from '@/lib/auth/google-oauth';

export interface CalendarService {
  createEvent: (userId: string, event: CalendarEventInput) => Promise<CalendarEvent | null>;
  getEvents: (userId: string, timeMin?: Date, timeMax?: Date) => Promise<CalendarEvent[]>;
  updateEvent: (userId: string, eventId: string, updates: Partial<CalendarEventInput>) => Promise<boolean>;
  deleteEvent: (userId: string, eventId: string) => Promise<boolean>;
  findFreeTime: (userId: string, duration: number, timeMin?: Date, timeMax?: Date) => Promise<Date[]>;
  scheduleWithContact: (userId: string, contactEmail: string, title: string, duration: number, preferredTimes?: Date[]) => Promise<CalendarEvent | null>;
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
  constructor() {
    // No longer need global initialization
  }

  private async getAuthenticatedCalendarClient(userId: string) {
    // Get user's Google auth
    const userAuth = await userAuthService.getGoogleAuth(userId);
    if (!userAuth) {
      throw new Error('User not authenticated with Google. Please connect your Google account first.');
    }

    // Ensure tokens are valid
    const validTokens = await googleOAuthService.ensureValidTokens(userAuth.tokens);
    
    // If tokens were refreshed, save them
    if (validTokens !== userAuth.tokens) {
      await userAuthService.saveGoogleAuth(userId, validTokens, userAuth.email, userAuth.scopes);
    }

    // Create authenticated client
    const authClient = googleOAuthService.getAuthenticatedClient(validTokens);
    return google.calendar({ version: 'v3', auth: authClient });
  }

  async createEvent(userId: string, eventInput: CalendarEventInput): Promise<CalendarEvent | null> {
    try {
      const calendar = await this.getAuthenticatedCalendarClient(userId);
      
      const eventData = {
        summary: eventInput.title,
        description: eventInput.description,
        location: eventInput.location,
        start: {
          dateTime: eventInput.start.toISOString(),
          timeZone: 'UTC',
        },
        end: {
          dateTime: eventInput.end.toISOString(),
          timeZone: 'UTC',
        },
        attendees: eventInput.attendees?.map(email => ({ email })),
        reminders: eventInput.reminders || {
          useDefault: true,
        },
      };

      const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: eventData,
      });

      if (response.data) {
        return this.parseCalendarEvent(response.data);
      }
      
      return null;
    } catch (error) {
      console.error('Failed to create calendar event:', error);
      throw error;
    }
  }

  async getEvents(userId: string, timeMin?: Date, timeMax?: Date): Promise<CalendarEvent[]> {
    try {
      const calendar = await this.getAuthenticatedCalendarClient(userId);
      
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: timeMin?.toISOString(),
        timeMax: timeMax?.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });

      const events: CalendarEvent[] = [];
      if (response.data.items) {
        for (const item of response.data.items) {
          const event = this.parseCalendarEvent(item);
          if (event) {
            events.push(event);
          }
        }
      }

      return events;
    } catch (error) {
      console.error('Failed to get calendar events:', error);
      return [];
    }
  }

  async updateEvent(userId: string, eventId: string, updates: Partial<CalendarEventInput>): Promise<boolean> {
    try {
      const calendar = await this.getAuthenticatedCalendarClient(userId);
      
      const updateData: any = {};
      if (updates.title) updateData.summary = updates.title;
      if (updates.description) updateData.description = updates.description;
      if (updates.location) updateData.location = updates.location;
      if (updates.attendees) updateData.attendees = updates.attendees.map(email => ({ email }));
      
      if (updates.start) {
        updateData.start = {
          dateTime: updates.start.toISOString(),
          timeZone: 'UTC',
        };
      }
      
      if (updates.end) {
        updateData.end = {
          dateTime: updates.end.toISOString(),
          timeZone: 'UTC',
        };
      }

      const response = await calendar.events.patch({
        calendarId: 'primary',
        eventId,
        requestBody: updateData,
      });

      return !!response.data;
    } catch (error) {
      console.error('Failed to update calendar event:', error);
      return false;
    }
  }

  async deleteEvent(userId: string, eventId: string): Promise<boolean> {
    try {
      const calendar = await this.getAuthenticatedCalendarClient(userId);
      
      await calendar.events.delete({
        calendarId: 'primary',
        eventId,
      });

      return true;
    } catch (error) {
      console.error('Failed to delete calendar event:', error);
      return false;
    }
  }

  async findFreeTime(userId: string, duration: number, timeMin?: Date, timeMax?: Date): Promise<Date[]> {
    try {
      const calendar = await this.getAuthenticatedCalendarClient(userId);
      
      const now = timeMin || new Date();
      const endTime = timeMax || new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

      const response = await calendar.freebusy.query({
        requestBody: {
          timeMin: now.toISOString(),
          timeMax: endTime.toISOString(),
          items: [{ id: 'primary' }],
        },
      });

      const busyTimes = response.data.calendars?.primary?.busy || [];
      const freeSlots: Date[] = [];

      // Simple algorithm to find free slots
      // eslint-disable-next-line prefer-const
      let currentTime = new Date(now);
      const endDate = new Date(endTime);

      while (currentTime < endDate) {
        const slotEnd = new Date(currentTime.getTime() + duration * 60 * 1000);
        
        const isSlotFree = !busyTimes.some((busy: any) => {
          const busyStart = new Date(busy.start);
          const busyEnd = new Date(busy.end);
          return (currentTime < busyEnd && slotEnd > busyStart);
        });

        if (isSlotFree) {
          freeSlots.push(new Date(currentTime));
        }

        // Move to next 30-minute slot
        currentTime.setMinutes(currentTime.getMinutes() + 30);
      }

      return freeSlots.slice(0, 10); // Return first 10 free slots
    } catch (error) {
      console.error('Failed to find free time:', error);
      return [];
    }
  }

  async scheduleWithContact(
    userId: string,
    contactEmail: string,
    title: string,
    duration: number,
    preferredTimes?: Date[]
  ): Promise<CalendarEvent | null> {
    try {
      let startTime: Date;
      
      if (preferredTimes && preferredTimes.length > 0) {
        startTime = preferredTimes[0];
      } else {
        const freeSlots = await this.findFreeTime(userId, duration);
        if (freeSlots.length === 0) {
          throw new Error('No free time slots available');
        }
        startTime = freeSlots[0];
      }

      const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

      return await this.createEvent(userId, {
        title,
        description: `Meeting with ${contactEmail}`,
        start: startTime,
        end: endTime,
        attendees: [contactEmail],
      });
    } catch (error) {
      console.error('Failed to schedule with contact:', error);
      return null;
    }
  }

  private parseCalendarEvent(eventData: any): CalendarEvent | null {
    try {
      return {
        id: eventData.id,
        title: eventData.summary || 'Untitled Event',
        description: eventData.description,
        start: new Date(eventData.start?.dateTime || eventData.start?.date),
        end: new Date(eventData.end?.dateTime || eventData.end?.date),
        attendees: eventData.attendees?.map((attendee: any) => ({
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