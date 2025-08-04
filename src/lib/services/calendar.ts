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
  checkConflicts: (userId: string, startTime: Date, endTime: Date) => Promise<ConflictResult>;
  smartSchedule: (userId: string, event: SmartScheduleInput) => Promise<SmartScheduleResult>;
  findOptimalTime: (userId: string, attendeeEmails: string[], duration: number, preferences?: SchedulingPreferences) => Promise<OptimalTimeResult>;
  rescheduleEvent: (userId: string, eventId: string, newStartTime: Date, checkConflicts?: boolean) => Promise<RescheduleResult>;
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

export interface ConflictResult {
  hasConflicts: boolean;
  conflicts: CalendarEvent[];
  suggestions?: Date[];
  message: string;
}

export interface SmartScheduleInput {
  title: string;
  description?: string;
  duration: number; // in minutes
  attendees?: string[];
  location?: string;
  preferredTimes?: Date[];
  timeRange?: {
    earliest: Date;
    latest: Date;
  };
  workingHours?: {
    start: number; // hour (0-23)
    end: number; // hour (0-23)
  };
  bufferTime?: number; // minutes before/after existing events
}

export interface SmartScheduleResult {
  success: boolean;
  event?: CalendarEvent;
  conflicts?: CalendarEvent[];
  alternativeTimes?: Date[];
  message: string;
}

export interface SchedulingPreferences {
  workingHours?: {
    start: number; // hour (0-23)
    end: number; // hour (0-23)
  };
  workingDays?: number[]; // 0-6 (Sunday-Saturday)
  bufferTime?: number; // minutes
  preferMorning?: boolean;
  preferAfternoon?: boolean;
  timeZone?: string;
}

export interface OptimalTimeResult {
  success: boolean;
  optimalTime?: Date;
  alternatives?: Date[];
  attendeeAvailability?: { [email: string]: boolean };
  message: string;
}

export interface RescheduleResult {
  success: boolean;
  event?: CalendarEvent;
  conflicts?: CalendarEvent[];
  message: string;
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

  async checkConflicts(userId: string, startTime: Date, endTime: Date): Promise<ConflictResult> {
    try {
      // Get events in the time range with some buffer
      const bufferStart = new Date(startTime.getTime() - 30 * 60 * 1000); // 30 min before
      const bufferEnd = new Date(endTime.getTime() + 30 * 60 * 1000); // 30 min after
      
      const existingEvents = await this.getEvents(userId, bufferStart, bufferEnd);
      
      // Find actual conflicts (overlapping events)
      const conflicts = existingEvents.filter(event => {
        const eventStart = new Date(event.start);
        const eventEnd = new Date(event.end);
        
        // Check for overlap
        return (startTime < eventEnd && endTime > eventStart);
      });

      const hasConflicts = conflicts.length > 0;
      
      let suggestions: Date[] = [];
      let message = '';

      if (hasConflicts) {
        // Find alternative times
        const duration = Math.ceil((endTime.getTime() - startTime.getTime()) / (60 * 1000));
        suggestions = await this.findFreeTime(userId, duration, startTime, 
          new Date(startTime.getTime() + 7 * 24 * 60 * 60 * 1000)); // next 7 days
        
        message = `Found ${conflicts.length} conflict(s). Suggested ${suggestions.length} alternative times.`;
      } else {
        message = 'No conflicts detected. Time slot is available.';
      }

      return {
        hasConflicts,
        conflicts,
        suggestions: suggestions.slice(0, 5), // Return top 5 suggestions
        message
      };
    } catch (error) {
      console.error('Failed to check conflicts:', error);
      return {
        hasConflicts: false,
        conflicts: [],
        message: 'Error checking conflicts'
      };
    }
  }

  async smartSchedule(userId: string, event: SmartScheduleInput): Promise<SmartScheduleResult> {
    try {
      const { title, description, duration, attendees, location, preferredTimes, timeRange, workingHours, bufferTime } = event;
      
      const candidateTimes: Date[] = [];
      
      // If preferred times are provided, check them first
      if (preferredTimes && preferredTimes.length > 0) {
        for (const preferredTime of preferredTimes) {
          const endTime = new Date(preferredTime.getTime() + duration * 60 * 1000);
          const conflictCheck = await this.checkConflicts(userId, preferredTime, endTime);
          
          if (!conflictCheck.hasConflicts) {
            // Found a slot without conflicts
            const newEvent = await this.createEvent(userId, {
              title,
              description,
              start: preferredTime,
              end: endTime,
              attendees,
              location
            });

            return {
              success: true,
              event: newEvent || undefined,
              message: `Event scheduled successfully for ${preferredTime.toLocaleString()}`
            };
          } else {
            candidateTimes.push(...(conflictCheck.suggestions || []));
          }
        }
      }
      
      // If no preferred times work, find optimal time
      const searchStart = timeRange?.earliest || new Date();
      const searchEnd = timeRange?.latest || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      
      const freeSlots = await this.findFreeTime(userId, duration, searchStart, searchEnd);
      
      // Filter by working hours if specified
      let filteredSlots = freeSlots;
      if (workingHours) {
        filteredSlots = freeSlots.filter(slot => {
          const hour = slot.getHours();
          return hour >= workingHours.start && hour <= workingHours.end;
        });
      }
      
      // Apply buffer time if specified
      if (bufferTime && bufferTime > 0) {
        filteredSlots = await this.filterSlotsWithBuffer(userId, filteredSlots, duration, bufferTime);
      }
      
      if (filteredSlots.length > 0) {
        const optimalTime = filteredSlots[0];
        const endTime = new Date(optimalTime.getTime() + duration * 60 * 1000);
        
        const newEvent = await this.createEvent(userId, {
          title,
          description,
          start: optimalTime,
          end: endTime,
          attendees,
          location
        });

        return {
          success: true,
          event: newEvent || undefined,
          alternativeTimes: filteredSlots.slice(1, 4), // Next 3 alternatives
          message: `Event scheduled successfully for ${optimalTime.toLocaleString()}`
        };
      } else {
        return {
          success: false,
          alternativeTimes: freeSlots.slice(0, 5),
          message: 'No suitable time slots found with the given constraints. Consider adjusting your preferences.'
        };
      }
    } catch (error) {
      console.error('Failed to smart schedule:', error);
      return {
        success: false,
        message: `Failed to schedule event: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async findOptimalTime(
    userId: string, 
    attendeeEmails: string[], 
    duration: number, 
    preferences?: SchedulingPreferences
  ): Promise<OptimalTimeResult> {
    try {
      // For now, we'll focus on the main user's calendar
      // In a full implementation, you'd check attendees' calendars too
      
      const now = new Date();
      const searchEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 2 weeks ahead
      
      let freeSlots = await this.findFreeTime(userId, duration, now, searchEnd);
      
      // Apply preferences if provided
      if (preferences) {
        freeSlots = this.applySchedulingPreferences(freeSlots, preferences);
      }
      
      const attendeeAvailability: { [email: string]: boolean } = {};
      attendeeEmails.forEach(email => {
        attendeeAvailability[email] = true; // Assume available for now
      });
      
      if (freeSlots.length > 0) {
        return {
          success: true,
          optimalTime: freeSlots[0],
          alternatives: freeSlots.slice(1, 5),
          attendeeAvailability,
          message: `Found optimal time: ${freeSlots[0].toLocaleString()}`
        };
      } else {
        return {
          success: false,
          attendeeAvailability,
          message: 'No suitable time slots found for all attendees'
        };
      }
    } catch (error) {
      console.error('Failed to find optimal time:', error);
      return {
        success: false,
        message: `Error finding optimal time: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async rescheduleEvent(
    userId: string, 
    eventId: string, 
    newStartTime: Date, 
    checkConflicts: boolean = true
  ): Promise<RescheduleResult> {
    try {
      // Get the existing event first
      const existingEvents = await this.getEvents(userId);
      const existingEvent = existingEvents.find(e => e.id === eventId);
      
      if (!existingEvent) {
        return {
          success: false,
          message: 'Event not found'
        };
      }
      
      // Calculate new end time based on original duration
      const originalDuration = existingEvent.end.getTime() - existingEvent.start.getTime();
      const newEndTime = new Date(newStartTime.getTime() + originalDuration);
      
      // Check for conflicts if requested
      if (checkConflicts) {
        const conflictCheck = await this.checkConflicts(userId, newStartTime, newEndTime);
        
        if (conflictCheck.hasConflicts) {
          return {
            success: false,
            conflicts: conflictCheck.conflicts,
            message: `Cannot reschedule due to ${conflictCheck.conflicts.length} conflict(s). Consider these alternative times.`
          };
        }
      }
      
      // Update the event
      const updateSuccess = await this.updateEvent(userId, eventId, {
        start: newStartTime,
        end: newEndTime
      });
      
      if (updateSuccess) {
        // Get the updated event
        const updatedEvents = await this.getEvents(userId);
        const updatedEvent = updatedEvents.find(e => e.id === eventId);
        
        return {
          success: true,
          event: updatedEvent,
          message: `Event successfully rescheduled to ${newStartTime.toLocaleString()}`
        };
      } else {
        return {
          success: false,
          message: 'Failed to update event'
        };
      }
    } catch (error) {
      console.error('Failed to reschedule event:', error);
      return {
        success: false,
        message: `Error rescheduling event: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // Helper method to filter slots with buffer time
  private async filterSlotsWithBuffer(
    userId: string, 
    slots: Date[], 
    duration: number, 
    bufferTime: number
  ): Promise<Date[]> {
    const filteredSlots: Date[] = [];
    
    for (const slot of slots) {
      const slotStart = new Date(slot.getTime() - bufferTime * 60 * 1000);
      const slotEnd = new Date(slot.getTime() + duration * 60 * 1000 + bufferTime * 60 * 1000);
      
      const conflictCheck = await this.checkConflicts(userId, slotStart, slotEnd);
      if (!conflictCheck.hasConflicts) {
        filteredSlots.push(slot);
      }
    }
    
    return filteredSlots;
  }

  // Helper method to apply scheduling preferences
  private applySchedulingPreferences(slots: Date[], preferences: SchedulingPreferences): Date[] {
    let filteredSlots = [...slots];
    
    // Filter by working hours
    if (preferences.workingHours) {
      filteredSlots = filteredSlots.filter(slot => {
        const hour = slot.getHours();
        return hour >= preferences.workingHours!.start && hour <= preferences.workingHours!.end;
      });
    }
    
    // Filter by working days
    if (preferences.workingDays) {
      filteredSlots = filteredSlots.filter(slot => {
        return preferences.workingDays!.includes(slot.getDay());
      });
    }
    
    // Sort by preference (morning vs afternoon)
    if (preferences.preferMorning) {
      filteredSlots.sort((a, b) => a.getHours() - b.getHours());
    } else if (preferences.preferAfternoon) {
      filteredSlots.sort((a, b) => b.getHours() - a.getHours());
    }
    
    return filteredSlots;
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