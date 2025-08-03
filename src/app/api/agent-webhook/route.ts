import { NextRequest, NextResponse } from 'next/server';
import { aiService } from '@/lib/services';
import type { IntentResult } from '@/lib/services/ai';

interface ElevenLabsWebhookPayload {
  user_message: string;
  conversation_history?: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp?: string;
  }>;
  user_id?: string;
  session_id?: string;
}

async function executeAction(intent: IntentResult): Promise<string> {
  try {
    // Determine action type based on intent content
    const actionType = intent.intent.toLowerCase();
    
    if (actionType.includes('email') || actionType.includes('send message')) {
      return `✅ Email action would be executed: ${intent.parameters.subject || 'No subject'}`;
    } else if (actionType.includes('sms') || actionType.includes('text')) {
      return `✅ SMS would be sent to: ${intent.parameters.to || 'contact'}`;
    } else if (actionType.includes('calendar') || actionType.includes('schedule') || actionType.includes('meeting')) {
      return `✅ Calendar event would be created: ${intent.parameters.title || 'New event'}`;
    } else if (actionType.includes('reminder') || actionType.includes('remind')) {
      return `✅ Reminder set for: ${intent.parameters.time || 'later'}`;
    } else {
      return `✅ Action recognized: ${intent.intent}`;
    }
  } catch (error) {
    console.error('Error executing action:', error);
    return `❌ Failed to execute action: ${intent.intent}`;
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload: ElevenLabsWebhookPayload = await req.json();
    const { user_message, conversation_history, user_id } = payload;

    console.log('🤖 ElevenLabs Agent Request:', { 
      message: user_message, 
      user: user_id,
      timestamp: new Date().toISOString()
    });

    // Build conversation context for better AI responses
    const contextMessages = conversation_history?.map(msg => 
      `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
    ).join('\n') || '';

    const systemPrompt = `You are Jarwik, a helpful AI assistant that can:
- Send emails and manage communication
- Schedule calendar events and meetings
- Send SMS messages and texts
- Set reminders and manage tasks
- Answer questions and provide information

Be conversational, helpful, and proactive. When users request actions, acknowledge what you'll do and ask for any missing details.`;

    const fullContext = `${systemPrompt}\n\nConversation History:\n${contextMessages}\n\nUser: ${user_message}`;
    
    // Generate intelligent response using OpenAI
    const aiResponse = await aiService.generateResponse(fullContext);

    // Parse for actionable intents
    const intent = await aiService.parseIntent(user_message);
    
    let actionResult = '';
    if (intent.action) {
      actionResult = await executeAction(intent);
    }

    // Combine AI response with action feedback
    const finalResponse = actionResult 
      ? `${aiResponse}\n\n${actionResult}`
      : aiResponse;

    console.log('✅ Sending AI Response:', { 
      response: finalResponse.substring(0, 100) + '...', 
      action: intent.action,
      intent: intent.intent 
    });

    return NextResponse.json({
      message: finalResponse,
      action_taken: intent.action || null,
      intent_detected: intent.intent || null,
      conversation_id: payload.session_id
    });

  } catch (error) {
    console.error('❌ Agent webhook error:', error);
    
    return NextResponse.json({
      message: "I'm sorry, I'm having trouble processing your request right now. Could you please try again?",
      error: process.env.NODE_ENV === 'development' ? String(error) : undefined
    }, { status: 500 });
  }
}

// Handle GET requests for webhook verification
export async function GET() {
  return NextResponse.json({
    message: 'ElevenLabs Agent Webhook Endpoint',
    status: 'active',
    capabilities: [
      'Natural language processing',
      'Email management', 
      'SMS sending',
      'Calendar scheduling',
      'Reminders and tasks'
    ]
  });
}
