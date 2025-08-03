// Lightweight intent parser to reduce OpenAI API calls
// This handles common patterns without calling OpenAI

export interface LightweightIntent {
  intent: string;
  confidence: number;
  entities: Record<string, unknown>;
  parameters: Record<string, unknown>;
  needsAI?: boolean; // True if we need to fall back to OpenAI
}

export function parseIntentLightweight(message: string): LightweightIntent {
  const lowerMessage = message.toLowerCase().trim();
  
  // Email patterns - High confidence, no AI needed
  const emailPatterns = [
    /(?:send|mail|email).{0,30}(?:to|at)\s+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
    /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i, // Fallback: any email
  ];

  for (const pattern of emailPatterns) {
    const match = message.match(pattern);
    if (match && (lowerMessage.includes('send') || lowerMessage.includes('mail') || lowerMessage.includes('email'))) {
      const email = match[1];
      
      // Find where the email appears in the message
      const emailIndex = message.indexOf(email);
      const afterEmail = message.substring(emailIndex + email.length);
      
      // Extract subject and body more carefully
      let subject = 'Message from Jarwik';
      let body = 'Hello from Jarwik!';
      
      // Look for content after the email address
      if (afterEmail.trim()) {
        const content = afterEmail.replace(/^(?:saying|about|that|with subject|:|-|\s)+/i, '').trim();
        if (content) {
          // If content has clear subject/body separation, parse it
          if (content.includes('subject')) {
            const subjectMatch = content.match(/subject[:\s]*([^,.\n;]+)/i);
            if (subjectMatch) {
              subject = subjectMatch[1].trim();
              body = content.replace(/subject[:\s]*[^,.\n;]+/i, '').trim() || body;
            }
          } else {
            // Use the content as body, and generate a subject from it
            body = content;
            subject = content.length > 30 ? content.substring(0, 30) + '...' : content;
          }
        }
      }
      
      return {
        intent: 'send_email',
        confidence: 0.95,
        entities: { recipient: email },
        parameters: { to: email, subject, body },
        needsAI: false
      };
    }
  }

  // Reminder patterns - High confidence, no AI needed
  const reminderPatterns = [
    /(?:set|create|add).{0,20}reminder.{0,50}(?:in|after|for).{0,10}(\d+).{0,10}(minute|hour|day)s?/i,
    /remind.{0,20}me.{0,50}(?:in|after).{0,10}(\d+).{0,10}(minute|hour|day)s?/i,
    /(?:set|create).{0,20}reminder.{0,50}(tomorrow|today|next week)/i,
  ];

  for (const pattern of reminderPatterns) {
    const match = message.match(pattern);
    if (match) {
      let timeStr = '';
      if (match[1] && match[2]) {
        timeStr = `${match[1]} ${match[2]}s`;
      } else if (match[1]) {
        timeStr = match[1];
      }
      
      const task = extractReminderTask(message) || 'reminder';
      
      return {
        intent: 'set_reminder',
        confidence: 0.9,
        entities: { time: timeStr, task },
        parameters: { reminder: task, time: timeStr },
        needsAI: false
      };
    }
  }

  // Calendar event patterns
  const calendarPatterns = [
    /(?:schedule|create|add).{0,20}(?:meeting|event|appointment)/i,
    /(?:book|set up).{0,20}(?:meeting|call|appointment)/i,
  ];

  for (const pattern of calendarPatterns) {
    if (pattern.test(message)) {
      const time = extractTime(message);
      const attendees = extractEmails(message);
      const title = extractEventTitle(message) || 'Meeting';
      
      return {
        intent: 'create_event',
        confidence: 0.85,
        entities: { time, attendees, title },
        parameters: { title, start: time, attendees },
        needsAI: false
      };
    }
  }

  // SMS patterns
  const smsPatterns = [
    /(?:send|text).{0,20}(?:sms|message).{0,50}(?:to|phone|number).{0,10}(\+?\d{10,15})/i,
    /(?:text|sms).{0,10}(\+?\d{10,15})/i,
  ];

  for (const pattern of smsPatterns) {
    const match = message.match(pattern);
    if (match) {
      const phone = match[1];
      const messageText = extractSMSText(message) || 'Hello!';
      
      return {
        intent: 'send_sms',
        confidence: 0.9,
        entities: { phone, messageText },
        parameters: { to: phone, message: messageText },
        needsAI: false
      };
    }
  }

  // If no patterns match, we need AI (but return a fallback)
  return {
    intent: 'general_chat',
    confidence: 0.3,
    entities: {},
    parameters: { query: message },
    needsAI: true
  };
}

// Helper functions for extraction
function extractReminderTask(message: string): string | null {
  const taskPatterns = [
    /remind.{0,20}me.{0,20}to\s+([^,.\n]{5,50})/i,
    /reminder.{0,20}(?:to|for|about)\s+([^,.\n]{5,50})/i,
    /reminder[:\-"]?\s*([^,.\n]{5,50})/i,
  ];
  
  for (const pattern of taskPatterns) {
    const match = message.match(pattern);
    if (match) return match[1].trim();
  }
  return null;
}

function extractTime(message: string): string | null {
  const timePatterns = [
    /(?:at|on|for)\s+(\d{1,2}:?\d{0,2}\s*(?:am|pm)?)/i,
    /(tomorrow|today|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
    /(?:in|after)\s+(\d+\s*(?:minute|hour|day)s?)/i,
  ];
  
  for (const pattern of timePatterns) {
    const match = message.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function extractEmails(message: string): string[] {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  return message.match(emailRegex) || [];
}

function extractEventTitle(message: string): string | null {
  const titlePatterns = [
    /(?:meeting|event|appointment).{0,20}(?:about|for|regarding)\s+([^,.\n]{5,30})/i,
    /(?:schedule|create|book)\s+([^,.\n]{5,30})\s+(?:meeting|event|appointment)/i,
  ];
  
  for (const pattern of titlePatterns) {
    const match = message.match(pattern);
    if (match) return match[1].trim();
  }
  return null;
}

function extractSMSText(message: string): string | null {
  const textPatterns = [
    /(?:saying|message|text)[:\-"]?\s*([^,.\n]{5,100})/i,
    /[:\-"]\s*([^,.\n]{5,100})/,
  ];
  
  for (const pattern of textPatterns) {
    const match = message.match(pattern);
    if (match) return match[1].trim();
  }
  return null;
}
