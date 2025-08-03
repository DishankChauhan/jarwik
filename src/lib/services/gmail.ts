import { google } from 'googleapis';

export interface GmailService {
  sendEmail: (to: string, subject: string, body: string) => Promise<boolean>;
  getEmails: (query?: string, maxResults?: number) => Promise<EmailMessage[]>;
  markAsRead: (messageId: string) => Promise<boolean>;
  replyToEmail: (messageId: string, body: string) => Promise<boolean>;
  draftEmail: (to: string, subject: string, body: string) => Promise<string>;
}

export interface EmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  body: string;
  snippet: string;
  date: Date;
  isRead: boolean;
  labels: string[];
}

class GmailServiceImpl implements GmailService {
  private gmail: any;
  private isInitialized = false;

  constructor() {
    this.initializeGmail();
  }

  private async initializeGmail() {
    try {
      // Use API key for simpler setup (read-only access)
      this.gmail = google.gmail({ 
        version: 'v1', 
        auth: process.env.GOOGLE_API_KEY 
      });
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize Gmail service:', error);
    }
  }

  private async ensureInitialized() {
    if (!this.isInitialized) {
      await this.initializeGmail();
    }
    if (!this.isInitialized) {
      throw new Error('Gmail service not initialized');
    }
  }

  async sendEmail(to: string, subject: string, body: string): Promise<boolean> {
    try {
      await this.ensureInitialized();

      const message = this.createMessage(to, subject, body);
      const response = await this.gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: message,
        },
      });

      return !!response.data.id;
    } catch (error) {
      console.error('Failed to send email:', error);
      return false;
    }
  }

  async getEmails(query: string = '', maxResults: number = 10): Promise<EmailMessage[]> {
    try {
      await this.ensureInitialized();

      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults,
      });

      const messages: EmailMessage[] = [];
      
      if (response.data.messages) {
        for (const message of response.data.messages) {
          const messageData = await this.gmail.users.messages.get({
            userId: 'me',
            id: message.id,
            format: 'full',
          });

          const emailMessage = this.parseEmailMessage(messageData.data);
          if (emailMessage) {
            messages.push(emailMessage);
          }
        }
      }

      return messages;
    } catch (error) {
      console.error('Failed to get emails:', error);
      return [];
    }
  }

  async markAsRead(messageId: string): Promise<boolean> {
    try {
      await this.ensureInitialized();

      await this.gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          removeLabelIds: ['UNREAD'],
        },
      });

      return true;
    } catch (error) {
      console.error('Failed to mark email as read:', error);
      return false;
    }
  }

  async replyToEmail(messageId: string, body: string): Promise<boolean> {
    try {
      await this.ensureInitialized();

      // Get original message to get thread ID and subject
      const originalMessage = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      });

      const headers = originalMessage.data.payload.headers;
      const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
      const from = headers.find((h: any) => h.name === 'From')?.value || '';
      const threadId = originalMessage.data.threadId;

      const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;
      const message = this.createMessage(from, replySubject, body, threadId);

      const response = await this.gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: message,
          threadId,
        },
      });

      return !!response.data.id;
    } catch (error) {
      console.error('Failed to reply to email:', error);
      return false;
    }
  }

  async draftEmail(to: string, subject: string, body: string): Promise<string> {
    try {
      await this.ensureInitialized();

      const message = this.createMessage(to, subject, body);
      const response = await this.gmail.users.drafts.create({
        userId: 'me',
        requestBody: {
          message: {
            raw: message,
          },
        },
      });

      return response.data.id || '';
    } catch (error) {
      console.error('Failed to create email draft:', error);
      return '';
    }
  }

  private createMessage(to: string, subject: string, body: string, threadId?: string): string {
    const messageParts = [
      `To: ${to}`,
      `Subject: ${subject}`,
      threadId ? `In-Reply-To: ${threadId}` : '',
      threadId ? `References: ${threadId}` : '',
      '',
      body,
    ].filter(Boolean);

    const message = messageParts.join('\n');
    return Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
  }

  private parseEmailMessage(messageData: any): EmailMessage | null {
    try {
      const headers = messageData.payload.headers;
      const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
      const from = headers.find((h: any) => h.name === 'From')?.value || '';
      const to = headers.find((h: any) => h.name === 'To')?.value || '';
      const date = headers.find((h: any) => h.name === 'Date')?.value || '';

      let body = '';
      if (messageData.payload.body?.data) {
        body = Buffer.from(messageData.payload.body.data, 'base64').toString();
      } else if (messageData.payload.parts) {
        // Handle multipart messages
        const textPart = messageData.payload.parts.find(
          (part: any) => part.mimeType === 'text/plain'
        );
        if (textPart?.body?.data) {
          body = Buffer.from(textPart.body.data, 'base64').toString();
        }
      }

      return {
        id: messageData.id,
        threadId: messageData.threadId,
        subject,
        from,
        to,
        body,
        snippet: messageData.snippet || '',
        date: new Date(date),
        isRead: !messageData.labelIds?.includes('UNREAD'),
        labels: messageData.labelIds || [],
      };
    } catch (error) {
      console.error('Failed to parse email message:', error);
      return null;
    }
  }
}

// Export singleton instance
export const gmailService = new GmailServiceImpl();
