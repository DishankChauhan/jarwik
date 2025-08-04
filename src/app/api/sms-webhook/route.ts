import { NextRequest, NextResponse } from 'next/server';
import { aiService, gmailService, twilioService, calendarService } from '@/lib/services';
import { userAuthService } from '@/lib/auth/user-auth';
import { parseNaturalTime, formatDateForUser } from '@/utils/timeParser';
import { parseIntentLightweight } from '@/utils/lightweightParser';
import type { IntentResult } from '@/lib/services/ai';

interface TwilioSMSWebhookPayload {
  MessageSid: string;
  AccountSid: string;
  From: string;
  To: string;
  Body: string;
  NumMedia?: string;
}

async function executeAction(intent: IntentResult, userId: string): Promise<string> {
  try {
    const actionType = intent.intent.toLowerCase();
    const params = intent.parameters;
    
    // First check if user has the required permissions
    const permissions = await userAuthService.getUserPermissions(userId);
    if (!permissions) {
      return '❌ Please connect your accounts first. Visit the Jarwik dashboard to authorize access to your Google services.';
    }
    
    if (actionType.includes('email') || actionType.includes('send_message')) {
      // Check email permission
      if (!permissions.email) {
        return '❌ Email permission not granted. Please connect your Gmail account in the Jarwik dashboard.';
      }

      // Actually send email using Gmail service
      const to = params.recipient || params.to || params.email;
      const subject = params.subject || 'Message from Jarwik';
      const body = params.message || params.body || params.content || 'Hello from Jarwik!';
      
      console.log('📧 SMS->Email Parameters:', { to, subject, body, allParams: params });
      
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
        
        if (result) {
          console.log('✅ Email sent successfully via SMS');
          return `✅ Email sent to ${to} with subject: "${subject}"`;
        } else {
          console.log('❌ Failed to send email via SMS');
          return `❌ Failed to send email to ${to}. Please try again or check your Gmail connection.`;
        }
      } catch (error) {
        console.error('❌ Email sending error via SMS:', error);
        return `❌ Error sending email: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    }
    
    if (actionType.includes('schedule') || actionType.includes('meeting') || actionType.includes('appointment') || actionType.includes('event')) {
      // Check calendar permission
      if (!permissions.calendar) {
        return '❌ Calendar permission not granted. Please connect your Google Calendar in the Jarwik dashboard.';
      }

      // Extract event details
      const title = params.title || params.subject || params.event || params.meeting || 'Event scheduled via SMS';
      const description = params.description || params.notes || params.details || `Event created via SMS`;
      
      console.log('📅 SMS->Calendar Parameters:', { title, description, allParams: params });
      
      // Parse time/date
      let startTime: Date | null = null;
      let endTime: Date;
      
      try {
        if (params.date && params.time) {
          // Both date and time provided
          const dateTimeStr = `${params.date} ${params.time}`;
          startTime = parseNaturalTime(dateTimeStr);
        } else if (params.datetime) {
          startTime = parseNaturalTime(String(params.datetime));
        } else if (params.date) {
          // Only date provided, assume 9 AM
          startTime = parseNaturalTime(`${params.date} 9:00 AM`);
        } else if (params.time) {
          // Only time provided, assume today
          const today = new Date().toISOString().split('T')[0];
          startTime = parseNaturalTime(`${today} ${params.time}`);
        } else {
          // No specific time, try to parse from original text or default to next hour
          const nextHour = new Date();
          nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
          startTime = nextHour;
        }
        
        if (!startTime) {
          throw new Error('Could not parse time');
        }
        
        // Set end time (1 hour after start by default)
        endTime = new Date(startTime.getTime() + (params.duration ? parseInt(String(params.duration)) * 60 * 1000 : 60 * 60 * 1000));
        
        console.log('🕒 Parsed times via SMS:', { startTime, endTime });
        
      } catch (error) {
        console.error('❌ Time parsing error via SMS:', error);
        return '❌ Could not understand the date/time. Please specify when you want to schedule the event (e.g., "tomorrow at 2pm", "Friday at 10:30am").';
      }

      try {
        // Check for conflicts using the correct method
        const conflictResult = await calendarService.checkConflicts(userId, startTime, endTime);
        
        if (conflictResult.hasConflicts) {
          const conflictDescriptions = conflictResult.conflicts.map((c) => 
            `"${c.title}" (${formatDateForUser(c.start)} - ${formatDateForUser(c.end)})`
          ).join(', ');
          
          // Try to find alternative time
          const alternatives = await calendarService.findOptimalTime(
            userId,
            [], // No specific attendees
            60, // 1 hour duration
            {
              workingHours: { start: 9, end: 17 },
              bufferTime: 15,
              timeZone: 'America/New_York' // Default timezone
            }
          );
          
          let conflictMessage = `⚠️ Time conflict detected with: ${conflictDescriptions}.`;
          
          if (alternatives.success && alternatives.alternatives && alternatives.alternatives.length > 0) {
            const altTime = formatDateForUser(alternatives.alternatives[0]);
            conflictMessage += ` Suggested alternative: ${altTime}. Reply "yes" to book the alternative time.`;
          } else {
            conflictMessage += ' Please choose a different time.';
          }
          
          return conflictMessage;
        }

        // Create the event with correct structure
        const event = await calendarService.createEvent(userId, {
          title: String(title),
          description: String(description),
          start: startTime,
          end: endTime,
          reminders: {
            useDefault: false,
            overrides: [
              { method: 'popup', minutes: 15 },
              { method: 'email', minutes: 60 }
            ]
          }
        });
        
        if (event) {
          console.log('✅ Event created successfully via SMS');
          return `✅ Event "${title}" scheduled for ${formatDateForUser(startTime)}`;
        } else {
          console.log('❌ Failed to create event via SMS');
          return '❌ Failed to create the event. Please try again or check your Calendar connection.';
        }
      } catch (error) {
        console.error('❌ Calendar event creation error via SMS:', error);
        return `❌ Error creating event: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    }
    
    if (actionType.includes('availability') || actionType.includes('free') || actionType.includes('busy')) {
      // Check calendar permission
      if (!permissions.calendar) {
        return '❌ Calendar permission not granted. Please connect your Google Calendar in the Jarwik dashboard.';
      }

      try {
        let checkDate: Date | null = null;
        if (params.date) {
          checkDate = parseNaturalTime(String(params.date));
        }
        
        if (!checkDate) {
          checkDate = new Date(); // Today
        }
        
        // Check availability for the day using conflict checking
        const startOfDay = new Date(checkDate);
        startOfDay.setHours(9, 0, 0, 0);
        const endOfDay = new Date(checkDate);
        endOfDay.setHours(17, 0, 0, 0);
        
        const conflictResult = await calendarService.checkConflicts(userId, startOfDay, endOfDay);
        
        if (!conflictResult.hasConflicts) {
          return `✅ You're completely free on ${formatDateForUser(checkDate)}.`;
        } else {
          const busyTimes = conflictResult.conflicts.map((e) => 
            `"${e.title}" (${formatDateForUser(e.start)} - ${formatDateForUser(e.end)})`
          ).join(', ');
          
          return `📅 You have ${conflictResult.conflicts.length} event(s) on ${formatDateForUser(checkDate)}: ${busyTimes}`;
        }
      } catch (error) {
        console.error('❌ Availability check error via SMS:', error);
        return `❌ Error checking availability: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    }
    
    if (actionType.includes('reminder') || actionType.includes('remind')) {
      return '⏰ Reminder feature is coming soon! For now, you can schedule calendar events which include automatic reminders.';
    }
    
    // Default response for unrecognized actions
    return `🤔 I understood your request but I'm not sure how to help with "${actionType}". I can help you:
• Send emails: "Send email to john@example.com about meeting"
• Schedule events: "Schedule meeting tomorrow at 2pm"
• Check availability: "Am I free on Friday?"`;
    
  } catch (error) {
    console.error('❌ SMS Action execution error:', error);
    return `❌ Sorry, something went wrong: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

export async function POST(req: NextRequest) {
  try {
    // Parse Twilio webhook payload (form-urlencoded)
    const formData = await req.formData();
    const payload: TwilioSMSWebhookPayload = {
      MessageSid: formData.get('MessageSid')?.toString() || '',
      AccountSid: formData.get('AccountSid')?.toString() || '',
      From: formData.get('From')?.toString() || '',
      To: formData.get('To')?.toString() || '',
      Body: formData.get('Body')?.toString() || '',
      NumMedia: formData.get('NumMedia')?.toString()
    };

    console.log('📱 Twilio SMS Webhook received:', {
      from: payload.From,
      to: payload.To,
      body: payload.Body,
      sid: payload.MessageSid
    });

    // Validate required fields
    if (!payload.From || !payload.Body) {
      console.error('❌ Invalid SMS webhook payload');
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // Get user ID from phone number
    const userId = await userAuthService.getUserByPhoneNumber(payload.From);
    
    if (!userId) {
      console.log('❌ Unknown phone number:', payload.From);
      
      // Send response to unknown user with registration instructions
      const helpMessage = `👋 Hi! I'm Jarwik, your AI assistant. 

To get started:
1. Visit https://jarwik.live/settings
2. Create an account and connect your Google services  
3. Add this phone number (${payload.From}) to your profile

Then I can help you:
• Schedule meetings
• Send emails
• Check your calendar
• And much more!

Visit: https://jarwik.live`;
      
      await twilioService.sendSMS(payload.From, helpMessage);
      
      return NextResponse.json({ 
        message: 'New user - registration help sent',
        status: 'unknown_user'
      });
    }

    console.log('👤 SMS from registered user:', { userId, phone: payload.From });

    // Parse the message using lightweight parser
    const parseResult = parseIntentLightweight(payload.Body);
    
    console.log('🧠 SMS Intent parsed:', {
      intent: parseResult.intent,
      confidence: parseResult.confidence,
      parameters: parseResult.parameters
    });

    // Execute the action
    let responseMessage: string;
    
    if (parseResult.confidence > 0.6) {
      // High confidence - execute directly
      responseMessage = await executeAction(parseResult, userId);
    } else {
      // Low confidence - use AI service for better understanding
      try {
        console.log('🤖 Low confidence, using AI service for SMS...');
        
        await aiService.generateResponse(payload.Body, {
          userId,
          previousMessages: [],
          currentTime: new Date(),
          timeZone: 'America/New_York'
        });
        
        // For SMS, we'll use a simpler fallback since we don't have structured AI intent parsing
        const simpleIntent: IntentResult = {
          intent: 'general_request',
          confidence: 0.5,
          entities: {},
          parameters: { message: payload.Body }
        };
        
        responseMessage = await executeAction(simpleIntent, userId);
      } catch (aiError) {
        console.error('❌ AI service error for SMS:', aiError);
        responseMessage = "Sorry, I couldn't understand your request. Please try rephrasing or contact support.";
      }
    }

    console.log('📤 Sending SMS Response:', { 
      to: payload.From,
      message: responseMessage.substring(0, 100) + (responseMessage.length > 100 ? '...' : '')
    });

    // Send response SMS
    const smsSent = await twilioService.sendSMS(payload.From, responseMessage);
    
    if (smsSent) {
      console.log('✅ SMS response sent successfully');
      return NextResponse.json({ 
        message: 'SMS processed and response sent',
        status: 'success',
        action: parseResult.intent
      });
    } else {
      console.error('❌ Failed to send SMS response');
      return NextResponse.json({ 
        message: 'SMS processed but response failed',
        status: 'partial_success',
        action: parseResult.intent
      }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ Twilio SMS Webhook error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Handle GET requests for webhook verification
export async function GET() {
  return NextResponse.json({
    status: 'Twilio SMS webhook endpoint active',
    timestamp: new Date().toISOString()
  });
}
