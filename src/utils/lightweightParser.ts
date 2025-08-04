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
    /(?:set|create|add).{0,20}reminder/i,
    /remind.{0,20}me/i,
  ];

  for (const pattern of reminderPatterns) {
    if (pattern.test(message)) {
      const timeStr = extractTime(message) || extractReminderTime(message);
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
    /(?:schedule|create|add|book|set up).{0,20}(?:meeting|event|appointment|call)/i,
    /(?:meeting|event|appointment).{0,30}(?:at|on|for|tomorrow|today|next)/i,
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
        parameters: { 
          title, 
          when: time, 
          time: time, 
          startTime: time,
          attendees 
        },
        needsAI: false
      };
    }
  }

  // Reschedule patterns - High confidence, no AI needed
  const reschedulePatterns = [
    /(?:reschedule|move|change).{0,30}(?:meeting|event|appointment)/i,
    /(?:reschedule|move|change time).{0,50}(?:to|for|at)/i,
  ];

  for (const pattern of reschedulePatterns) {
    if (pattern.test(message)) {
      const eventId = extractEventId(message);
      const newTime = extractTime(message);
      
      return {
        intent: 'reschedule',
        confidence: 0.9,
        entities: { eventId, newTime },
        parameters: { 
          eventId, 
          newTime, 
          time: newTime 
        },
        needsAI: false
      };
    }
  }

  // Schedule checking patterns - improved to handle various queries
  const schedulePatterns = [
    // "how's my schedule today", "what's my schedule tomorrow"
    /(?:how.s|what.s|show).{0,20}(?:my\s+)?schedule.{0,30}(?:for\s+)?(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
    // "my schedule for today", "schedule today"
    /(?:my\s+)?schedule.{0,20}(?:for\s+)?(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
    // "what do I have today", "what's on my calendar"
    /(?:what|how).{0,20}(?:do\s+i\s+have|on\s+my\s+calendar).{0,30}(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
  ];

  for (const pattern of schedulePatterns) {
    const match = message.match(pattern);
    if (match) {
      const day = match[1];
      
      return {
        intent: 'check_schedule',
        confidence: 0.9,
        entities: { day },
        parameters: { 
          day,
          time: day,
          action: 'view_schedule'
        },
        needsAI: false
      };
    }
  }

  // Availability checking patterns - improved for specific time slots
  const availabilityPatterns = [
    // "is my 5pm free today", "am I free at 3pm tomorrow"
    /(?:is|am).{0,20}(?:my\s+)?(\d{1,2}:?\d{0,2}\s*(?:am|pm)?).{0,20}free.{0,20}(today|tomorrow)/i,
    // "is 5pm free today", "is tomorrow at 3pm free"
    /is.{0,20}(\d{1,2}:?\d{0,2}\s*(?:am|pm)?|today|tomorrow).{0,20}(?:at\s+)?(\d{1,2}:?\d{0,2}\s*(?:am|pm)?|today|tomorrow)?.{0,20}free/i,
    // "am I available at 5pm", "free at 3pm today"
    /(?:am\s+i\s+)?(?:available|free).{0,20}(?:at\s+)?(\d{1,2}:?\d{0,2}\s*(?:am|pm)?).{0,20}(today|tomorrow)?/i,
    // "do I have anything at 5pm today"
    /do\s+i\s+have.{0,30}(?:at\s+)?(\d{1,2}:?\d{0,2}\s*(?:am|pm)?).{0,20}(today|tomorrow)/i,
  ];

  for (const pattern of availabilityPatterns) {
    const match = message.match(pattern);
    if (match) {
      let time = '';
      let day = '';
      
      // Parse the matched groups to extract time and day
      if (match[1] && match[2]) {
        // Both time and day present
        if (match[1].includes('pm') || match[1].includes('am') || /^\d/.test(match[1])) {
          time = match[1];
          day = match[2];
        } else {
          day = match[1];
          time = match[2];
        }
      } else if (match[1]) {
        // Only one match - could be time or day
        if (match[1].includes('pm') || match[1].includes('am') || /^\d/.test(match[1])) {
          time = match[1];
          day = 'today'; // default
        } else {
          day = match[1];
        }
      }
      
      const fullTime = day && time ? `${day} at ${time}` : (time || day || 'now');
      
      return {
        intent: 'check_availability',
        confidence: 0.9,
        entities: { time: fullTime, day, specificTime: time },
        parameters: { 
          startTime: fullTime,
          time: fullTime,
          day,
          specificTime: time,
          duration: 60, // default 1 hour check
          action: 'check_free'
        },
        needsAI: false
      };
    }
  }

  // General conflict checking patterns
  const conflictPatterns = [
    /(?:check|any).{0,20}conflicts?.{0,30}(?:at|on|for)/i,
    /(?:check|see).{0,20}availability.{0,30}(?:at|on|for)/i,
  ];

  for (const pattern of conflictPatterns) {
    if (pattern.test(message)) {
      const time = extractTime(message);
      const duration = extractDuration(message) || 60;
      
      return {
        intent: 'check_conflicts',
        confidence: 0.85,
        entities: { time, duration },
        parameters: { 
          startTime: time, 
          time: time,
          duration 
        },
        needsAI: false
      };
    }
  }

  // Find optimal time patterns
  const optimalTimePatterns = [
    /(?:find|suggest|when).{0,20}(?:best|optimal|good).{0,20}time/i,
    /(?:find|when).{0,30}(?:free|available).{0,20}time/i,
  ];

  for (const pattern of optimalTimePatterns) {
    if (pattern.test(message)) {
      const attendees = extractEmails(message);
      const duration = extractDuration(message) || 60;
      
      return {
        intent: 'find_time',
        confidence: 0.8,
        entities: { attendees, duration },
        parameters: { 
          attendees, 
          duration 
        },
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
    // "reminder for today at 5pm to go to gym" -> "go to gym"
    /reminder.{0,50}to\s+([^,.\n]{3,50})/i,
    // "remind me to review the proposal" -> "review the proposal"
    /remind.{0,20}me.{0,20}to\s+([^,.\n]{5,50})/i,
    // "set a reminder to call john" -> "call john"
    /reminder.{0,20}(?:to|for|about)\s+([^,.\n]{5,50})/i,
    // "reminder: call john" -> "call john"
    /reminder[:\-"]?\s*([^,.\n]{5,50})/i,
  ];
  
  for (const pattern of taskPatterns) {
    const match = message.match(pattern);
    if (match) {
      const task = match[1].trim();
      // Clean up the task by removing time references
      const cleanTask = task.replace(/(today|tomorrow|at\s+\d{1,2}:?\d{0,2}\s*(?:am|pm)?)/gi, '').trim();
      return cleanTask || task;
    }
  }
  return null;
}

function extractReminderTime(message: string): string | null {
  // Specific patterns for reminder time extraction
  const reminderTimePatterns = [
    // "reminder for today at 5pm" -> "today at 5pm"
    /reminder.{0,20}(?:for|at|on)\s+(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+(?:at\s+)?(\d{1,2}:?\d{0,2}\s*(?:am|pm)?)/i,
    // "set reminder for 3pm today" -> "today at 3pm"
    /reminder.{0,20}(?:for|at|on)\s+(\d{1,2}:?\d{0,2}\s*(?:am|pm)?)\s+(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
    // "remind me at 5pm today" -> "today at 5pm"
    /remind.{0,20}me.{0,20}(?:at|on)\s+(\d{1,2}:?\d{0,2}\s*(?:am|pm)?)\s+(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
    // "remind me today at 5pm" -> "today at 5pm"
    /remind.{0,20}me.{0,20}(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+(?:at\s+)?(\d{1,2}:?\d{0,2}\s*(?:am|pm)?)/i,
    // "reminder for wednesday at 1pm" -> "wednesday at 1pm"
    /reminder.{0,20}(?:for|on)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+at\s+(\d{1,2}:?\d{0,2}\s*(?:am|pm)?))?/i,
    // "set a reminder for wednesday at 1pm to go to lunch with mom" -> "wednesday at 1pm"
    /set.{0,20}reminder.{0,20}for\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+at\s+(\d{1,2}:?\d{0,2}\s*(?:am|pm)?))?/i,
    
    // IMPROVED: Better relative time patterns
    // "set a reminder 30 mins from now" -> "in 30 minutes"
    /reminder.{0,30}(\d+)\s*(min|mins|minute|minutes|hour|hours|day|days)\s+(?:from\s+now|later)/i,
    // "remind me in 30 minutes" -> "in 30 minutes"
    /remind.{0,20}me.{0,20}(?:in|after)\s+(\d+)\s*(min|mins|minute|minutes|hour|hours|day|days)/i,
    // "set reminder in 2 hours" -> "in 2 hours"
    /set.{0,20}reminder.{0,20}(?:in|after)\s+(\d+)\s*(min|mins|minute|minutes|hour|hours|day|days)/i,
    // "30 minutes from now" -> "in 30 minutes"
    /(\d+)\s*(min|mins|minute|minutes|hour|hours|day|days)\s+from\s+now/i,
    // Basic relative times like "in 30 minutes", "in 2 hours"
    /(?:in|after)\s+(\d+)\s*(min|mins|minute|minutes|hour|hours|day|days)/i,
  ];
  
  for (const pattern of reminderTimePatterns) {
    const match = message.match(pattern);
    if (match) {
      // Handle relative time patterns like "30 mins from now"
      if (match[1] && match[2] && /\d+/.test(match[1])) {
        const number = match[1];
        const unit = match[2].toLowerCase();
        
        // Normalize units
        let normalizedUnit = unit;
        if (unit.startsWith('min')) {
          normalizedUnit = number === '1' ? 'minute' : 'minutes';
        } else if (unit.startsWith('hour')) {
          normalizedUnit = number === '1' ? 'hour' : 'hours';
        } else if (unit.startsWith('day')) {
          normalizedUnit = number === '1' ? 'day' : 'days';
        }
        
        return `in ${number} ${normalizedUnit}`;
      }
      
      // Handle absolute time patterns like "today at 5pm"
      if (match[1] && match[2]) {
        // Handle cases like "today" + "5pm" or "5pm" + "today"
        const firstMatch = match[1].toLowerCase();
        const secondMatch = match[2].toLowerCase();
        
        const days = ['today', 'tomorrow', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        
        if (days.includes(firstMatch)) {
          return match[2] ? `${match[1]} at ${match[2]}` : match[1];
        } else if (days.includes(secondMatch)) {
          return `${match[2]} at ${match[1]}`;
        }
        return `${match[1]} ${match[2]}`;
      }
      
      // Single match - could be a day or relative time
      if (match[1]) {
        // If it's a relative time pattern like "30 minutes"
        if (/\d+\s*(?:min|minute|hour|day)/.test(match[1])) {
          return `in ${match[1]}`;
        }
        return match[1];
      }
    }
  }
  return null;
}

function extractTime(message: string): string | null {
  const timePatterns = [
    // Better handling of "today at 5pm", "tomorrow at 3:30 AM", "wednesday at 1pm"
    /(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+(?:at\s+)?(\d{1,2}:?\d{0,2}\s*(?:am|pm)?)/i,
    // Specific times like "at 3 PM", "at 10:30 AM"
    /(?:at|on|for)\s+(\d{1,2}:?\d{0,2}\s*(?:am|pm)?)/i,
    // Relative days like "tomorrow", "next Monday"
    /(tomorrow|today|next\s+(?:week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
    // IMPROVED: Better relative time patterns
    // "30 mins from now", "2 hours from now"
    /(\d+)\s*(min|mins|minute|minutes|hour|hours|day|days)\s+from\s+now/i,
    // "in 30 minutes", "in 2 hours"
    /(?:in|after)\s+(\d+)\s*(min|mins|minute|minutes|hour|hours|day|days)/i,
    // Just times without "at" like "3 PM tomorrow", "1pm wednesday"
    /(\d{1,2}:?\d{0,2}\s*(?:am|pm))\s+(tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
  ];
  
  for (const pattern of timePatterns) {
    const match = message.match(pattern);
    if (match) {
      // Handle relative time patterns like "30 mins from now"
      if (match[1] && match[2] && /\d+/.test(match[1])) {
        const number = match[1];
        const unit = match[2].toLowerCase();
        
        // Normalize units
        let normalizedUnit = unit;
        if (unit.startsWith('min')) {
          normalizedUnit = number === '1' ? 'minute' : 'minutes';
        } else if (unit.startsWith('hour')) {
          normalizedUnit = number === '1' ? 'hour' : 'hours';
        } else if (unit.startsWith('day')) {
          normalizedUnit = number === '1' ? 'day' : 'days';
        }
        
        return `in ${number} ${normalizedUnit}`;
      }
      
      // For patterns with multiple groups, combine them intelligently
      if (match[1] && match[2]) {
        const firstMatch = match[1].toLowerCase();
        const secondMatch = match[2].toLowerCase();
        
        const days = ['today', 'tomorrow', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        
        // Handle "today at 5pm" -> "today at 5pm"
        if (days.includes(firstMatch)) {
          return `${match[1]} at ${match[2]}`;
        }
        // Handle "3pm wednesday" -> "wednesday at 3pm"
        else if (days.includes(secondMatch)) {
          return `${match[2]} at ${match[1]}`;
        }
        // Handle "Monday 3pm" -> "Monday at 3pm"
        return `${match[1]} at ${match[2]}`;
      }
      return match[1];
    }
  }
  return null;
}

function extractEmails(message: string): string[] {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  return message.match(emailRegex) || [];
}

function extractEventTitle(message: string): string | null {
  const titlePatterns = [
    // "meeting about project review", "event for team standup"
    /(?:meeting|event|appointment|call)\s+(?:about|for|regarding)\s+([^,.\n]{3,40})/i,
    // "schedule project review meeting", "create team standup event"
    /(?:schedule|create|book)\s+([^,.\n]{3,40})\s+(?:meeting|event|appointment|call)/i,
    // "project review at 3 PM", "team standup tomorrow"
    /([^,.\n]{3,40})\s+(?:at|on|tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
    // Quoted titles like "schedule 'project review' tomorrow"
    /['"']([^'"]{3,40})['""]/,
  ];
  
  for (const pattern of titlePatterns) {
    const match = message.match(pattern);
    if (match) {
      const title = match[1].trim();
      // Filter out common time words that aren't titles
      const timeWords = /^(at|on|for|in|after|tomorrow|today|next|am|pm|\d+)$/i;
      if (!timeWords.test(title) && title.length > 2) {
        return title;
      }
    }
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

function extractEventId(message: string): string | null {
  const idPatterns = [
    // UUIDs like "123e4567-e89b-12d3-a456-426614174000"
    /(\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b)/i,
    // Numeric IDs like "event 12345" or "id 67890"
    /(?:event|id)\s+(\d{5,})/i,
  ];
  
  for (const pattern of idPatterns) {
    const match = message.match(pattern);
    if (match) return match[1].trim();
  }
  return null;
}

function extractDuration(message: string): number | null {
  const durationPatterns = [
    // Specific durations like "for 30 minutes", "for 2 hours"
    /(?:for|in|about)\s+(\d+)\s*(minute|hour|day)s?/i,
    // Ranges like "from 2 to 3 PM", "between 1 and 2 hours"
    /(?:from|between)\s+(\d+)\s*(?:to|-)\s+(\d+)\s*(minute|hour|day)s?/i,
  ];
  
  for (const pattern of durationPatterns) {
    const match = message.match(pattern);
    if (match) {
      // For ranges, return the difference
      if (match[2]) {
        const start = parseInt(match[1], 10);
        const end = parseInt(match[2], 10);
        return Math.abs(end - start);
      }
      return parseInt(match[1], 10);
    }
  }
  return null;
}
