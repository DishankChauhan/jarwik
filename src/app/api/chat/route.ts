import { NextRequest, NextResponse } from 'next/server';
import { aiService, gmailService, twilioService, calendarService } from '@/lib/services';
import { userAuthService } from '@/lib/auth/user-auth';
import { parseNaturalTime, formatDateForUser } from '@/utils/timeParser';
import { parseIntentLightweight } from '@/utils/lightweightParser';
import type { IntentResult } from '@/lib/services/ai';

interface ChatRequest {
  message: string;
  userId: string;
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp?: string;
  }>;
}

async function executeAction(intent: IntentResult, userId: string): Promise<string> {
  try {
    const actionType = intent.intent.toLowerCase();
    const params = intent.parameters;
    
    // First check if user has the required permissions
    const permissions = await userAuthService.getUserPermissions(userId);
    if (!permissions) {
      return '❌ Please connect your accounts first. Go to Settings > Connected Accounts to authorize Jarwik to access your Google services.';
    }
    
    if (actionType.includes('email') || actionType.includes('send_message')) {
      // Check email permission
      if (!permissions.email) {
        return '❌ Email permission not granted. Please connect your Gmail account in Settings > Connected Accounts.';
      }

      // Actually send email using Gmail service
      const to = params.recipient || params.to || params.email;
      const subject = params.subject || 'Message from Jarwik';
      const body = params.message || params.body || params.content || 'Hello from Jarwik!';
      
      console.log('📧 Email Parameters:', { to, subject, body, allParams: params });
      
      if (!to) {
        return '❌ Please specify who you want to send the email to.';
      }

      try {
        const result = await gmailService.sendEmail(
          userId,
          String(to),
          String(subject),
          String(body)
        );
        return result 
          ? `✅ Email sent successfully to ${to}!` 
          : `❌ Failed to send email to ${to}. Please try again.`;
      } catch (error) {
        console.error('Email sending failed:', error);
        return `❌ Failed to send email to ${to}. Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
      
    } else if (actionType.includes('sms') || actionType.includes('text')) {
      // Check SMS permission
      if (!permissions.sms) {
        return '❌ SMS functionality not available. Please check Twilio configuration.';
      }

      // Actually send SMS using Twilio service
      const to = params.recipient || params.to || params.phone || params.number;
      const message = params.message || params.body || params.content || 'Hello from Jarwik!';
      
      if (!to) {
        return '❌ Please specify the phone number to send the SMS to.';
      }

      try {
        const result = await twilioService.sendSMS(
          String(to),
          String(message)
        );
        return result
          ? `✅ SMS sent successfully to ${to}!`
          : `❌ Failed to send SMS to ${to}. Please try again.`;
      } catch (error) {
        console.error('SMS sending failed:', error);
        return `❌ Failed to send SMS to ${to}. Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
      
    } else if (actionType.includes('check_schedule') || intent.intent === 'check_schedule') {
      // Check calendar permission
      if (!permissions.calendar) {
        return '❌ Calendar permission required to check your schedule. Please connect your Google Calendar in Settings > Connected Accounts.';
      }

      const day = params.day || params.time || 'today';
      
      try {
        // Parse the day to get start and end of day
        let startOfDay: Date;
        let endOfDay: Date;
        
        const now = new Date();
        const dayLower = String(day).toLowerCase();
        
        if (dayLower === 'today') {
          startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        } else if (dayLower === 'tomorrow') {
          const tomorrow = new Date(now);
          tomorrow.setDate(tomorrow.getDate() + 1);
          startOfDay = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
          endOfDay = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 23, 59, 59);
        } else {
          // Handle specific days of the week
          const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
          const dayIndex = daysOfWeek.indexOf(dayLower);
          
          if (dayIndex !== -1) {
            // Find the next occurrence of this day
            const currentDay = now.getDay();
            let daysToAdd = dayIndex - currentDay;
            if (daysToAdd <= 0) daysToAdd += 7; // Next occurrence
            
            const targetDate = new Date(now);
            targetDate.setDate(targetDate.getDate() + daysToAdd);
            
            startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
            endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59);
          } else {
            return `❌ I couldn't understand the day "${day}". Please try "today", "tomorrow", or a specific day like "Monday".`;
          }
        }

        const events = await calendarService.getEvents(userId, startOfDay, endOfDay);
        
        if (events.length === 0) {
          const dayDesc = dayLower === 'today' ? 'today' : dayLower === 'tomorrow' ? 'tomorrow' : formatDateForUser(startOfDay);
          return `📅 Your schedule for ${dayDesc} is clear! No events scheduled.`;
        } else {
          const dayDesc = dayLower === 'today' ? 'today' : dayLower === 'tomorrow' ? 'tomorrow' : formatDateForUser(startOfDay);
          let message = `📅 Your schedule for ${dayDesc}:\n`;
          
          // Sort events by start time
          events.sort((a, b) => a.start.getTime() - b.start.getTime());
          
          events.forEach((event, index) => {
            const startTime = event.start.toLocaleTimeString('en-US', { 
              hour: 'numeric', 
              minute: '2-digit', 
              hour12: true 
            });
            const endTime = event.end.toLocaleTimeString('en-US', { 
              hour: 'numeric', 
              minute: '2-digit', 
              hour12: true 
            });
            message += `\n${index + 1}. ${event.title} (${startTime} - ${endTime})`;
            if (event.location) {
              message += ` at ${event.location}`;
            }
          });
          
          return message;
        }
      } catch (error) {
        console.error('Schedule checking failed:', error);
        return `❌ Failed to check your schedule. Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
      
    } else if (actionType.includes('check_availability') || intent.intent === 'check_availability') {
      // Check calendar permission
      if (!permissions.calendar) {
        return '❌ Calendar permission required to check availability. Please connect your Google Calendar in Settings > Connected Accounts.';
      }

      const startTimeInput = params.startTime || params.time;
      const specificTime = params.specificTime;
      const day = params.day || 'today';
      
      try {
        let fullTimeString = startTimeInput;
        if (specificTime && day) {
          fullTimeString = `${day} at ${specificTime}`;
        }
        
        if (!fullTimeString) {
          return '❌ Please specify when you want to check availability.';
        }

        // Parse the natural language time
        const startTime = parseNaturalTime(String(fullTimeString));
        if (!startTime) {
          return `❌ I couldn't understand the time "${fullTimeString}". Please try something like "today at 5 PM" or "tomorrow at 3 PM".`;
        }

        // Default 1-hour window for availability check
        const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

        const conflicts = await calendarService.getEvents(userId, startTime, endTime);
        
        if (conflicts.length === 0) {
          const timeDesc = formatDateForUser(startTime);
          return `✅ Yes, you're free at ${timeDesc}! No conflicts found.`;
        } else {
          const timeDesc = formatDateForUser(startTime);
          let message = `❌ No, you have a conflict at ${timeDesc}:`;
          
          conflicts.forEach((event, index) => {
            const eventStartTime = event.start.toLocaleTimeString('en-US', { 
              hour: 'numeric', 
              minute: '2-digit', 
              hour12: true 
            });
            const eventEndTime = event.end.toLocaleTimeString('en-US', { 
              hour: 'numeric', 
              minute: '2-digit', 
              hour12: true 
            });
            message += `\n${index + 1}. ${event.title} (${eventStartTime} - ${eventEndTime})`;
          });
          
          return message;
        }
      } catch (error) {
        console.error('Availability checking failed:', error);
        return `❌ Failed to check availability. Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
      
    } else if (actionType.includes('calendar') || actionType.includes('schedule') || actionType.includes('meeting')) {
      // Check calendar permission
      if (!permissions.calendar) {
        return '❌ Calendar permission not granted. Please connect your Google Calendar in Settings > Connected Accounts.';
      }

      // Extract event details
      const title = params.title || params.subject || params.event || 'New Event';
      const description = params.description || params.notes || params.message || '';
      const startTimeInput = params.startTime || params.time || params.when || params.start;
      const endTime = params.endTime || params.end;
      const attendees = params.attendees || params.invitees || [];
      const duration = params.duration ? parseInt(String(params.duration)) : 60; // Default 1 hour
      const checkConflicts = params.checkConflicts !== false; // Default to true
      
      console.log('📅 Calendar Parameters:', { title, startTimeInput, endTime, attendees, duration, checkConflicts, allParams: params });
      
      if (!startTimeInput) {
        return '❌ Please specify when you want to schedule the event.';
      }

      // Parse the natural language time using our time parser
      const parsedStartTime = parseNaturalTime(String(startTimeInput));
      if (!parsedStartTime) {
        return `❌ I couldn't understand the time "${startTimeInput}". Please try something like "tomorrow at 3 PM", "next Monday at 10 AM", or "in 2 hours".`;
      }

      // Ensure the time is in the future
      if (parsedStartTime <= new Date()) {
        return `❌ The event time "${startTimeInput}" appears to be in the past. Please specify a future time.`;
      }

      // Calculate end time if not provided
      let parsedEndTime;
      if (endTime) {
        parsedEndTime = parseNaturalTime(String(endTime));
        if (!parsedEndTime) {
          parsedEndTime = new Date(parsedStartTime.getTime() + duration * 60 * 1000);
        }
      } else {
        parsedEndTime = new Date(parsedStartTime.getTime() + duration * 60 * 1000);
      }

      try {
        // Use smart scheduling if conflicts should be checked
        if (checkConflicts) {
          const smartScheduleResult = await calendarService.smartSchedule(userId, {
            title: String(title),
            description: String(description),
            duration: duration,
            attendees: Array.isArray(attendees) ? attendees.map(String) : [],
            preferredTimes: [parsedStartTime],
            timeRange: {
              earliest: parsedStartTime,
              latest: new Date(parsedStartTime.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days range
            },
            workingHours: {
              start: 9, // 9 AM
              end: 17  // 5 PM
            },
            bufferTime: 15 // 15 minutes buffer
          });

          if (smartScheduleResult.success && smartScheduleResult.event) {
            const timeDescription = formatDateForUser(smartScheduleResult.event.start);
            return `✅ Calendar event "${title}" scheduled successfully ${timeDescription}! Event ID: ${smartScheduleResult.event.id}`;
          } else {
            // If scheduling failed, provide alternatives
            let message = `❌ ${smartScheduleResult.message}`;
            
            if (smartScheduleResult.alternativeTimes && smartScheduleResult.alternativeTimes.length > 0) {
              message += '\n\n🕒 Alternative times available:';
              smartScheduleResult.alternativeTimes.slice(0, 3).forEach((altTime, index) => {
                message += `\n${index + 1}. ${formatDateForUser(altTime)}`;
              });
              message += '\n\nWould you like me to schedule for one of these times instead?';
            }
            
            return message;
          }
        } else {
          // Create event directly without conflict checking
          const event = await calendarService.createEvent(userId, {
            title: String(title),
            description: String(description),
            start: parsedStartTime,
            end: parsedEndTime,
            attendees: Array.isArray(attendees) ? attendees.map(String) : []
          });
          
          const timeDescription = formatDateForUser(parsedStartTime);
          return event 
            ? `✅ Calendar event "${title}" created successfully ${timeDescription}! Event ID: ${event.id}`
            : `❌ Failed to create calendar event "${title}".`;
        }
      } catch (error) {
        console.error('Calendar event creation failed:', error);
        return `❌ Failed to create calendar event "${title}". Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
      
    } else if (actionType.includes('call') || actionType.includes('phone')) {
      // Check call permission
      if (!permissions.calls) {
        return '❌ Call functionality not available. Please check Twilio configuration.';
      }

      // Handle phone calls using Twilio
      const to = params.recipient || params.to || params.phone || params.number;
      const message = params.message || 'This is a call from Jarwik AI Assistant.';
      
      if (!to) {
        return '❌ Please specify the phone number to call.';
      }

      try {
        const result = await twilioService.makeCall(
          String(to),
          String(message)
        );
        return result
          ? `✅ Call initiated to ${to}!`
          : `❌ Failed to initiate call to ${to}.`;
      } catch (error) {
        console.error('Call initiation failed:', error);
        return `❌ Failed to initiate call to ${to}. Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
      
    } else if (actionType.includes('reminder') || actionType.includes('remind')) {
      // Check calendar permission for reminders
      if (!permissions.calendar) {
        return '❌ Reminder functionality requires calendar access. Please connect your Google Calendar in Settings > Connected Accounts.';
      }

      // Create a calendar reminder
      const title = `Reminder: ${params.task || params.reminder || params.message || 'Task'}`;
      const timeInput = params.time || params.when;
      
      if (!timeInput) {
        return '❌ Please specify when you want to be reminded.';
      }

      // Parse the natural language time
      const parsedTime = parseNaturalTime(String(timeInput));
      if (!parsedTime) {
        return `❌ I couldn't understand the time "${timeInput}". Please try something like "in 20 minutes", "tomorrow at 3 PM", or "next Tuesday".`;
      }

      // Ensure the time is in the future
      if (parsedTime <= new Date()) {
        return `❌ The reminder time "${timeInput}" appears to be in the past. Please specify a future time.`;
      }

      try {
        const event = await calendarService.createEvent(userId, {
          title: title,
          description: 'Reminder created by Jarwik AI Assistant',
          start: parsedTime,
          end: new Date(parsedTime.getTime() + 15 * 60 * 1000), // 15 minutes
          attendees: [],
          reminders: {
            useDefault: false,
            overrides: [
              { method: 'popup', minutes: 0 }, // Show popup at event time
              { method: 'email', minutes: 5 }  // Send email 5 minutes before
            ]
          }
        });
        
        const timeDescription = formatDateForUser(parsedTime);
        return event
          ? `✅ Reminder set for "${title.replace('Reminder: ', '')}" ${timeDescription}!`
          : `❌ Failed to set reminder for ${timeInput}.`;
      } catch (error) {
        console.error('Reminder creation failed:', error);
        return `❌ Failed to set reminder for ${timeInput}. Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
      
    } else if (actionType.includes('reschedule') || actionType.includes('move') || actionType.includes('change time')) {
      // Check calendar permission for rescheduling
      if (!permissions.calendar) {
        return '❌ Calendar permission required for rescheduling. Please connect your Google Calendar in Settings > Connected Accounts.';
      }

      const eventId = params.eventId || params.id;
      const newTimeInput = params.newTime || params.time || params.when;
      
      if (!eventId) {
        return '❌ Please specify the event ID or title to reschedule.';
      }
      
      if (!newTimeInput) {
        return '❌ Please specify the new time for the event.';
      }

      // Parse the new time
      const newStartTime = parseNaturalTime(String(newTimeInput));
      if (!newStartTime) {
        return `❌ I couldn't understand the new time "${newTimeInput}". Please try something like "tomorrow at 3 PM" or "next Friday at 2 PM".`;
      }

      // Ensure the new time is in the future
      if (newStartTime <= new Date()) {
        return `❌ The new time "${newTimeInput}" appears to be in the past. Please specify a future time.`;
      }

      try {
        const rescheduleResult = await calendarService.rescheduleEvent(
          userId,
          String(eventId),
          newStartTime,
          true // Check for conflicts
        );

        if (rescheduleResult.success && rescheduleResult.event) {
          const timeDescription = formatDateForUser(rescheduleResult.event.start);
          return `✅ Event rescheduled successfully to ${timeDescription}! Event ID: ${rescheduleResult.event.id}`;
        } else if (rescheduleResult.conflicts && rescheduleResult.conflicts.length > 0) {
          let message = `❌ ${rescheduleResult.message}\n\n⚠️  Conflicting events:`;
          rescheduleResult.conflicts.forEach((conflict, index) => {
            message += `\n${index + 1}. ${conflict.title} (${formatDateForUser(conflict.start)})`;
          });
          return message;
        } else {
          return `❌ ${rescheduleResult.message}`;
        }
      } catch (error) {
        console.error('Event rescheduling failed:', error);
        return `❌ Failed to reschedule event. Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }

    } else if (actionType.includes('check conflicts') || actionType.includes('check availability')) {
      // Check calendar permission
      if (!permissions.calendar) {
        return '❌ Calendar permission required to check conflicts. Please connect your Google Calendar in Settings > Connected Accounts.';
      }

      const startTimeInput = params.startTime || params.time || params.when || params.start;
      const endTimeInput = params.endTime || params.end;
      const duration = params.duration ? parseInt(String(params.duration)) : 60;
      
      if (!startTimeInput) {
        return '❌ Please specify the time to check for conflicts.';
      }

      // Parse the time
      const startTime = parseNaturalTime(String(startTimeInput));
      if (!startTime) {
        return `❌ I couldn't understand the time "${startTimeInput}". Please try something like "tomorrow at 3 PM" or "next Monday at 10 AM".`;
      }

      // Calculate end time
      let endTime;
      if (endTimeInput) {
        endTime = parseNaturalTime(String(endTimeInput));
        if (!endTime) {
          endTime = new Date(startTime.getTime() + duration * 60 * 1000);
        }
      } else {
        endTime = new Date(startTime.getTime() + duration * 60 * 1000);
      }

      try {
        const conflictResult = await calendarService.checkConflicts(userId, startTime, endTime);
        
        if (!conflictResult.hasConflicts) {
          const timeDescription = formatDateForUser(startTime);
          return `✅ No conflicts found! The time slot ${timeDescription} is available.`;
        } else {
          let message = `⚠️  Found ${conflictResult.conflicts.length} conflict(s) for ${formatDateForUser(startTime)}:\n`;
          
          conflictResult.conflicts.forEach((conflict, index) => {
            message += `\n${index + 1}. ${conflict.title} (${formatDateForUser(conflict.start)} - ${formatDateForUser(conflict.end)})`;
          });

          if (conflictResult.suggestions && conflictResult.suggestions.length > 0) {
            message += '\n\n🕒 Alternative available times:';
            conflictResult.suggestions.slice(0, 3).forEach((suggestion, index) => {
              message += `\n${index + 1}. ${formatDateForUser(suggestion)}`;
            });
          }

          return message;
        }
      } catch (error) {
        console.error('Conflict checking failed:', error);
        return `❌ Failed to check for conflicts. Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
      
    } else if (actionType.includes('find time') || actionType.includes('optimal time')) {
      // Check calendar permission
      if (!permissions.calendar) {
        return '❌ Calendar permission required to find optimal time. Please connect your Google Calendar in Settings > Connected Accounts.';
      }

      const attendees = params.attendees || params.invitees || [];
      const duration = params.duration ? parseInt(String(params.duration)) : 60;
      const preferMorning = actionType.includes('morning');
      const preferAfternoon = actionType.includes('afternoon');
      
      try {
        const optimalResult = await calendarService.findOptimalTime(
          userId,
          Array.isArray(attendees) ? attendees.map(String) : [],
          duration,
          {
            workingHours: { start: 9, end: 17 },
            workingDays: [1, 2, 3, 4, 5], // Monday to Friday
            bufferTime: 15,
            preferMorning,
            preferAfternoon
          }
        );

        if (optimalResult.success && optimalResult.optimalTime) {
          let message = `✅ Optimal time found: ${formatDateForUser(optimalResult.optimalTime)}`;
          
          if (optimalResult.alternatives && optimalResult.alternatives.length > 0) {
            message += '\n\n🕒 Alternative times:';
            optimalResult.alternatives.slice(0, 3).forEach((alt, index) => {
              message += `\n${index + 1}. ${formatDateForUser(alt)}`;
            });
          }
          
          return message;
        } else {
          return `❌ ${optimalResult.message}`;
        }
      } catch (error) {
        console.error('Finding optimal time failed:', error);
        return `❌ Failed to find optimal time. Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
      
    } else if (actionType.includes('check_schedule') || intent.intent === 'check_schedule') {
      // Check calendar permission
      if (!permissions.calendar) {
        return '❌ Calendar permission required to check your schedule. Please connect your Google Calendar in Settings > Connected Accounts.';
      }

      const day = params.day || params.time || 'today';
      
      try {
        // Parse the day to get start and end of day
        let startOfDay: Date;
        let endOfDay: Date;
        
        const dayLower = String(day).toLowerCase();
        const now = new Date();
        
        if (dayLower === 'today') {
          startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        } else if (dayLower === 'tomorrow') {
          const tomorrow = new Date(now);
          tomorrow.setDate(tomorrow.getDate() + 1);
          startOfDay = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
          endOfDay = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 23, 59, 59);
        } else {
          // Handle specific days like "monday", "tuesday", etc.
          const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
          const dayIndex = days.indexOf(dayLower);
          
          if (dayIndex !== -1) {
            // Find the next occurrence of this day
            const currentDay = now.getDay();
            let daysToAdd = dayIndex - currentDay;
            if (daysToAdd <= 0) daysToAdd += 7; // Next occurrence
            
            const targetDate = new Date(now);
            targetDate.setDate(targetDate.getDate() + daysToAdd);
            
            startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
            endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59);
          } else {
            return `❌ I couldn't understand the day "${day}". Please try "today", "tomorrow", or a specific day like "Monday".`;
          }
        }

        const events = await calendarService.getEvents(userId, startOfDay, endOfDay);
        
        if (events.length === 0) {
          const dayDesc = dayLower === 'today' ? 'today' : dayLower === 'tomorrow' ? 'tomorrow' : formatDateForUser(startOfDay);
          return `📅 Your schedule for ${dayDesc} is clear! No events scheduled.`;
        } else {
          const dayDesc = dayLower === 'today' ? 'today' : dayLower === 'tomorrow' ? 'tomorrow' : formatDateForUser(startOfDay);
          let message = `📅 Your schedule for ${dayDesc}:\n`;
          
          // Sort events by start time
          events.sort((a, b) => a.start.getTime() - b.start.getTime());
          
          events.forEach((event, index) => {
            const startTime = event.start.toLocaleTimeString('en-US', { 
              hour: 'numeric', 
              minute: '2-digit', 
              hour12: true 
            });
            const endTime = event.end.toLocaleTimeString('en-US', { 
              hour: 'numeric', 
              minute: '2-digit', 
              hour12: true 
            });
            message += `\n${index + 1}. ${event.title} (${startTime} - ${endTime})`;
            if (event.location) {
              message += ` at ${event.location}`;
            }
          });
          
          return message;
        }
      } catch (error) {
        console.error('Schedule checking failed:', error);
        return `❌ Failed to check your schedule. Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
      
    } else if (actionType.includes('check_availability') || intent.intent === 'check_availability') {
      // Check calendar permission
      if (!permissions.calendar) {
        return '❌ Calendar permission required to check availability. Please connect your Google Calendar in Settings > Connected Accounts.';
      }

      const timeInput = params.startTime || params.time || params.specificTime;
      const day = params.day || 'today';
      const duration = parseInt(String(params.duration || 60)); // Default 1 hour
      
      try {
        // Build the full time string for parsing
        let fullTimeString = '';
        const timeStr = String(timeInput || '');
        const dayStr = String(day);
        
        // Smart parsing for common patterns
        if (timeStr.includes('today') || timeStr.includes('tomorrow')) {
          fullTimeString = timeStr; // Already contains day info
        } else if (timeStr && (dayStr === 'today' || dayStr === 'tomorrow')) {
          fullTimeString = `${dayStr} at ${timeStr}`;
        } else if (timeStr && dayStr) {
          // Handle specific days like "wednesday"
          const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
          if (days.includes(dayStr.toLowerCase())) {
            fullTimeString = `${dayStr} at ${timeStr}`;
          } else {
            fullTimeString = timeStr;
          }
        } else if (timeStr) {
          fullTimeString = timeStr;
        } else {
          return '❌ Please specify the time to check availability.';
        }

        // Parse the time
        const checkTime = parseNaturalTime(fullTimeString);
        if (!checkTime) {
          return `❌ I couldn't understand the time "${fullTimeString}". Please try something like "today at 5 PM" or "tomorrow at 3 PM".`;
        }

        // Calculate end time for the availability window
        const endTime = new Date(checkTime.getTime() + duration * 60 * 1000);

        // Check for conflicts in that time slot
        const conflictResult = await calendarService.checkConflicts(userId, checkTime, endTime);
        
        const timeDescription = checkTime.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit', 
          hour12: true 
        });
        
        let dayDescription: string;
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        if (checkTime.toDateString() === today.toDateString()) {
          dayDescription = 'today';
        } else if (checkTime.toDateString() === tomorrow.toDateString()) {
          dayDescription = 'tomorrow';
        } else {
          dayDescription = checkTime.toLocaleDateString('en-US', { weekday: 'long' });
        }
        
        if (!conflictResult.hasConflicts) {
          return `✅ Yes, your ${timeDescription} slot is free ${dayDescription}! No conflicts found.`;
        } else {
          let message = `❌ No, you have a conflict at ${timeDescription} ${dayDescription}:\n`;
          
          conflictResult.conflicts.forEach((conflict, index) => {
            const conflictStart = conflict.start.toLocaleTimeString('en-US', { 
              hour: 'numeric', 
              minute: '2-digit', 
              hour12: true 
            });
            const conflictEnd = conflict.end.toLocaleTimeString('en-US', { 
              hour: 'numeric', 
              minute: '2-digit', 
              hour12: true 
            });
            message += `\n${index + 1}. ${conflict.title} (${conflictStart} - ${conflictEnd})`;
          });

          return message;
        }
      } catch (error) {
        console.error('Availability checking failed:', error);
        return `❌ Failed to check availability. Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }      
    } else {
      return `✅ I understood your request: ${intent.intent}, but I'm not sure how to execute that action yet. I can help you with emails, SMS, calls, calendar events, and reminders.`;
    }
  } catch (error) {
    console.error('Error executing action:', error);
    return `❌ Failed to execute action: ${intent.intent}. Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { message, userId, conversationHistory }: ChatRequest = await req.json();

    if (!message || !userId) {
      return NextResponse.json(
        { error: 'Message and userId are required' },
        { status: 400 }
      );
    }

    console.log('💬 Chat Input:', { 
      message, 
      userId,
      timestamp: new Date().toISOString(),
      hasHistory: !!conversationHistory?.length
    });

    // OPTIMIZATION: Try lightweight parsing first to avoid OpenAI API calls
    const lightweightIntent = parseIntentLightweight(message);
    let intent: IntentResult;
    let actionResult = '';

    if (!lightweightIntent.needsAI && lightweightIntent.confidence > 0.8) {
      // High confidence - use lightweight parsing, no OpenAI call needed
      intent = {
        intent: lightweightIntent.intent,
        confidence: lightweightIntent.confidence,
        entities: lightweightIntent.entities,
        parameters: lightweightIntent.parameters,
        action: lightweightIntent.intent === 'general_chat' ? undefined : lightweightIntent.intent
      };
      
      console.log('⚡ Using Lightweight Parser (no OpenAI):', { 
        intent: intent.intent, 
        confidence: intent.confidence,
        saved_money: true
      });
    } else {
      // Fall back to OpenAI for complex queries
      intent = await aiService.parseIntent(message);
      console.log('🤖 Using OpenAI Parser:', { 
        intent: intent.intent, 
        confidence: intent.confidence 
      });
    }
    
    // Execute action if needed
    if (intent.action || (intent.intent !== 'general_chat' && intent.confidence > 0.7)) {
      actionResult = await executeAction(intent, userId);
      console.log('🎯 Action Executed:', { 
        intent: intent.intent, 
        success: !actionResult.includes('❌')
      });
    }

    // Generate response only if we need general chat
    let aiResponse = '';
    if (intent.intent === 'general_chat') {
      aiResponse = await aiService.generateResponse(message, {
        userId: userId,
        currentTime: new Date(),
        timeZone: 'UTC',
        previousMessages: conversationHistory?.slice(-2).map(msg => ({
          role: msg.role,
          content: msg.content
        })) || []
      });
    }

    // Determine final response
    let finalResponse = '';
    if (actionResult) {
      // Action was executed - return the action result (whether success or failure)
      finalResponse = actionResult;
    } else {
      // General chat - just AI response
      finalResponse = aiResponse;
    }

    console.log('✅ Sending Chat Response:', { 
      responseLength: finalResponse.length,
      hasAction: !!intent.action,
      preview: finalResponse.substring(0, 150) + '...'
    });

    return NextResponse.json({
      message: finalResponse,
      action_taken: intent.action || null,
      intent_detected: intent.intent || null,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Chat API error:', error);
    
    return NextResponse.json({
      message: "I'm sorry, I'm having trouble processing your request right now. Could you please try again?",
      error: process.env.NODE_ENV === 'development' ? String(error) : undefined,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}


