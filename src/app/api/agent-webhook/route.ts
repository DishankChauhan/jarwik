import { NextRequest, NextResponse } from 'next/server';
import { aiService, gmailService, twilioService, calendarService } from '@/lib/services';
import { userAuthService } from '@/lib/auth/user-auth';
import { parseNaturalTime, formatDateForUser } from '@/utils/timeParser';
import { parseIntentLightweight } from '@/utils/lightweightParser';
import type { IntentResult } from '@/lib/services/ai';

interface ElevenLabsWebhookPayload {
  conversation_id: string;
  user_message: string;
  agent_id: string;
  timestamp: string;
  metadata?: {
    user_id?: string;
  };
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
          parsedEndTime = new Date(parsedStartTime.getTime() + duration * 60 * 1000); // Default duration
        }
      } else {
        parsedEndTime = new Date(parsedStartTime.getTime() + duration * 60 * 1000); // Default duration
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
          ? `✅ Reminder set: "${title.replace('Reminder: ', '')}" ${timeDescription}! Event ID: ${event.id}`
          : `❌ Failed to set reminder for ${timeInput}.`;
      } catch (error) {
        console.error('Reminder creation failed:', error);
        return `❌ Failed to set reminder for ${timeInput}. Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
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
          // For other days, try to parse with time parser
          const parsedDay = parseNaturalTime(String(day));
          if (parsedDay) {
            startOfDay = new Date(parsedDay.getFullYear(), parsedDay.getMonth(), parsedDay.getDate());
            endOfDay = new Date(parsedDay.getFullYear(), parsedDay.getMonth(), parsedDay.getDate(), 23, 59, 59);
          } else {
            return `❌ I couldn't understand the day "${day}". Please try "today", "tomorrow", or a specific day.`;
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
      
      if (!timeInput) {
        return '❌ Please specify the time you want to check availability for.';
      }

      try {
        // Create full time string for parsing
        let fullTimeString = String(timeInput);
        if (day && !String(timeInput).includes(String(day))) {
          fullTimeString = `${day} at ${timeInput}`;
        }
        
        const startTime = parseNaturalTime(String(fullTimeString));
        if (!startTime) {
          return `❌ I couldn't understand the time "${timeInput}". Please try something like "5pm" or "3:30 PM".`;
        }

        const endTime = new Date(startTime.getTime() + duration * 60 * 1000);
        
        // Check for conflicts in the time slot
        const conflictResult = await calendarService.checkConflicts(userId, startTime, endTime);
        
        const timeDesc = startTime.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit', 
          hour12: true 
        });
        const dayDesc = day === 'today' ? 'today' : day === 'tomorrow' ? 'tomorrow' : day;
        
        if (!conflictResult.hasConflicts) {
          return `✅ Yes, you're free at ${timeDesc} ${dayDesc}! No conflicts found.`;
        } else {
          let message = `❌ No, you have a conflict at ${timeDesc} ${dayDesc}:\n`;
          
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
            if (conflict.location) {
              message += ` at ${conflict.location}`;
            }
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
    const payload: ElevenLabsWebhookPayload = await req.json();
    
    console.log('🎙️ ElevenLabs Webhook received:', {
      conversation_id: payload.conversation_id,
      user_message: payload.user_message,
      agent_id: payload.agent_id,
      timestamp: payload.timestamp
    });

    // Extract user ID from metadata or use a default
    const userId = payload.metadata?.user_id || 'default-user';
    const userMessage = payload.user_message;

    if (!userMessage) {
      return NextResponse.json({ 
        response: "I didn't hear anything. Could you please try again?" 
      });
    }

    // OPTIMIZATION: Try lightweight parsing first to avoid OpenAI API calls
    const lightweightIntent = parseIntentLightweight(userMessage);
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
      intent = await aiService.parseIntent(userMessage);
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

    // Generate response only if we need general chat or action failed
    let aiResponse = '';
    if (intent.intent === 'general_chat' || actionResult.includes('❌')) {
      aiResponse = await aiService.generateResponse(userMessage, {
        userId: userId,
        currentTime: new Date(),
        timeZone: 'UTC',
        previousMessages: [] // No conversation history in webhook
      });
    } else {
      // For successful actions, use a simple confirmation
      aiResponse = "Great! I've taken care of that for you.";
    }

    // Combine AI response with action feedback
    const finalResponse = actionResult 
      ? `${aiResponse}\n\n${actionResult}`
      : aiResponse;

    console.log('✅ Sending Webhook Response:', { 
      responseLength: finalResponse.length,
      hasAction: !!intent.action,
      preview: finalResponse.substring(0, 150) + '...'
    });

    return NextResponse.json({
      response: finalResponse,
      action_taken: intent.action || null,
      intent_detected: intent.intent || null,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ ElevenLabs Webhook error:', error);
    
    return NextResponse.json({
      response: "I'm sorry, I'm having trouble processing your request right now. Could you please try again?",
      error: process.env.NODE_ENV === 'development' ? String(error) : undefined,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// Handle GET requests for webhook verification
export async function GET() {
  return NextResponse.json({ 
    status: 'ElevenLabs webhook endpoint active',
    timestamp: new Date().toISOString()
  });
}
