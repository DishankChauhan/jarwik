// Service exports
export { gmailService } from './gmail';
export { calendarService } from './calendar';
export { twilioService } from './twilio';
export { contactsService } from './contacts';
export { aiService } from './ai';

// Type exports
export type { 
  GmailService, 
  EmailMessage 
} from './gmail';

export type { 
  CalendarService, 
  CalendarEvent, 
  CalendarEventInput 
} from './calendar';

export type { 
  TwilioService, 
  SMSMessage, 
  CallLog 
} from './twilio';

export type { 
  ContactsService, 
  Contact, 
  ContactInput 
} from './contacts';

export type { 
  AIService, 
  ConversationContext, 
  IntentResult, 
  ActionItem 
} from './ai';
