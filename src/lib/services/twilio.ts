import twilio from 'twilio';

export interface TwilioService {
  sendSMS: (to: string, message: string) => Promise<boolean>;
  makeCall: (to: string, message: string) => Promise<boolean>;
  getMessages: (limit?: number) => Promise<SMSMessage[]>;
  getCallLogs: (limit?: number) => Promise<CallLog[]>;
}

export interface SMSMessage {
  sid: string;
  from: string;
  to: string;
  body: string;
  status: string;
  direction: 'inbound' | 'outbound-api' | 'outbound-call' | 'outbound-reply';
  dateCreated: Date;
  dateSent?: Date;
  price?: string;
}

export interface CallLog {
  sid: string;
  from: string;
  to: string;
  status: string;
  direction: 'inbound' | 'outbound-api' | 'outbound-dial';
  duration?: string;
  startTime?: Date;
  endTime?: Date;
  price?: string;
}

class TwilioServiceImpl implements TwilioService {
  private client: twilio.Twilio | null = null;
  private isInitialized = false;
  private phoneNumber: string;

  constructor() {
    this.phoneNumber = process.env.TWILIO_PHONE_NUMBER || '';
    this.initializeTwilio();
  }

  private async initializeTwilio() {
    try {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;

      if (!accountSid || !authToken || !this.phoneNumber) {
        console.warn('Twilio credentials not configured');
        return;
      }

      this.client = twilio(accountSid, authToken);
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize Twilio service:', error);
    }
  }

  private async ensureInitialized() {
    if (!this.isInitialized) {
      await this.initializeTwilio();
    }
    if (!this.isInitialized || !this.client) {
      throw new Error('Twilio service not initialized');
    }
  }

  async sendSMS(to: string, message: string): Promise<boolean> {
    try {
      await this.ensureInitialized();

      const response = await this.client!.messages.create({
        body: message,
        from: this.phoneNumber,
        to: this.formatPhoneNumber(to),
      });

      return response.status === 'queued' || response.status === 'sent';
    } catch (error) {
      console.error('Failed to send SMS:', error);
      return false;
    }
  }

  async makeCall(to: string, message: string): Promise<boolean> {
    try {
      await this.ensureInitialized();

      // Create TwiML for text-to-speech
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Say voice="alice">${this.escapeXML(message)}</Say>
        </Response>`;

      const response = await this.client!.calls.create({
        twiml,
        from: this.phoneNumber,
        to: this.formatPhoneNumber(to),
      });

      return response.status === 'queued' || response.status === 'ringing' || response.status === 'in-progress';
    } catch (error) {
      console.error('Failed to make call:', error);
      return false;
    }
  }

  async getMessages(limit: number = 20): Promise<SMSMessage[]> {
    try {
      await this.ensureInitialized();

      const messages = await this.client!.messages.list({
        limit,
      });

      return messages.map(message => ({
        sid: message.sid,
        from: message.from,
        to: message.to,
        body: message.body || '',
        status: message.status,
        direction: message.direction as SMSMessage['direction'],
        dateCreated: message.dateCreated,
        dateSent: message.dateSent || undefined,
        price: message.price || undefined,
      }));
    } catch (error) {
      console.error('Failed to get messages:', error);
      return [];
    }
  }

  async getCallLogs(limit: number = 20): Promise<CallLog[]> {
    try {
      await this.ensureInitialized();

      const calls = await this.client!.calls.list({
        limit,
      });

      return calls.map(call => ({
        sid: call.sid,
        from: call.from,
        to: call.to,
        status: call.status,
        direction: call.direction as CallLog['direction'],
        duration: call.duration || undefined,
        startTime: call.startTime || undefined,
        endTime: call.endTime || undefined,
        price: call.price || undefined,
      }));
    } catch (error) {
      console.error('Failed to get call logs:', error);
      return [];
    }
  }

  private formatPhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters
    const digits = phoneNumber.replace(/\D/g, '');
    
    // Add +1 if it's a US number without country code
    if (digits.length === 10) {
      return `+1${digits}`;
    }
    
    // Add + if not present
    if (!phoneNumber.startsWith('+')) {
      return `+${digits}`;
    }
    
    return phoneNumber;
  }

  private escapeXML(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

// Export singleton instance
export const twilioService = new TwilioServiceImpl();
