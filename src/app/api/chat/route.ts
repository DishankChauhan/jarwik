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
      
    } else if (actionType.includes('calendar') || actionType.includes('schedule') || actionType.includes('meeting')) {
      // Check calendar permission
      if (!permissions.calendar) {
        return '❌ Calendar permission not granted. Please connect your Google Calendar in Settings > Connected Accounts.';
      }

      // Actually create calendar event
      const title = params.title || params.subject || params.event || 'New Event';
      const description = params.description || params.notes || params.message || '';
      const startTime = params.startTime || params.time || params.when;
      const endTime = params.endTime;
      const attendees = params.attendees || params.invitees || [];
      
      if (!startTime) {
        return '❌ Please specify when you want to schedule the event.';
      }

      try {
        const event = await calendarService.createEvent(userId, {
          title: String(title),
          description: String(description),
          start: new Date(String(startTime)),
          end: endTime ? new Date(String(endTime)) : new Date(Date.now() + 60 * 60 * 1000), // Default 1 hour
          attendees: Array.isArray(attendees) ? attendees.map(String) : []
        });
        return event 
          ? `✅ Calendar event "${title}" created successfully! Event ID: ${event.id}`
          : `❌ Failed to create calendar event "${title}".`;
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

    // Generate response only if we need general chat or action failed
    let aiResponse = '';
    if (intent.intent === 'general_chat' || actionResult.includes('❌')) {
      aiResponse = await aiService.generateResponse(message, {
        userId: userId,
        currentTime: new Date(),
        timeZone: 'UTC',
        previousMessages: conversationHistory?.slice(-2).map(msg => ({
          role: msg.role,
          content: msg.content
        })) || []
      });
    } else {
      // For successful actions, use a simple confirmation
      aiResponse = "Great! I've taken care of that for you.";
    }

    // Combine AI response with action feedback
    const finalResponse = actionResult 
      ? `${aiResponse}\n\n${actionResult}`
      : aiResponse;

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


