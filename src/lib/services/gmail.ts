import { google } from 'googleapis';
import { userAuthService } from '@/lib/auth/user-auth';
import { googleOAuthService } from '@/lib/auth/google-oauth';

export interface GmailService {
  sendEmail: (userId: string, to: string, subject: string, body: string) => Promise<boolean>;
  getEmails: (userId: string, query?: string, maxResults?: number) => Promise<EmailMessage[]>;
  markAsRead: (userId: string, messageId: string) => Promise<boolean>;
  replyToEmail: (userId: string, messageId: string, body: string) => Promise<boolean>;
  draftEmail: (userId: string, to: string, subject: string, body: string) => Promise<string>;
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
  constructor() {
    // No longer need global initialization
  }

  private async getAuthenticatedGmailClient(userId: string) {
    // Get user's Google auth
    const userAuth = await userAuthService.getGoogleAuth(userId);
    if (!userAuth) {
      throw new Error('User not authenticated with Google. Please connect your Google account first.');
    }

    // Ensure tokens are valid
    const validTokens = await googleOAuthService.ensureValidTokens(userAuth.tokens);
    
    // If tokens were refreshed, save them
    if (validTokens !== userAuth.tokens) {
      await userAuthService.saveGoogleAuth(userId, validTokens, userAuth.email, userAuth.scopes);
    }

    // Create authenticated client
    const authClient = googleOAuthService.getAuthenticatedClient(validTokens);
    return google.gmail({ version: 'v1', auth: authClient });
  }

  async sendEmail(userId: string, to: string, subject: string, body: string): Promise<boolean> {
    try {
      const gmail = await this.getAuthenticatedGmailClient(userId);

      const message = this.createMessage(to, subject, body);
      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: message,
        },
      });

      return !!response.data.id;
    } catch (error) {
      console.error('Failed to send email:', error);
      throw error;
    }
  }

  async getEmails(userId: string, query: string = '', maxResults: number = 10): Promise<EmailMessage[]> {
    try {
      const gmail = await this.getAuthenticatedGmailClient(userId);

      const response = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults,
      });

      const messages: EmailMessage[] = [];
      
      if (response.data.messages) {
        for (const message of response.data.messages) {
          if (message.id) {
            const messageData = await gmail.users.messages.get({
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
      }

      return messages;
    } catch (error) {
      console.error('Failed to get emails:', error);
      return [];
    }
  }

  async markAsRead(userId: string, messageId: string): Promise<boolean> {
    try {
      const gmail = await this.getAuthenticatedGmailClient(userId);

      await gmail.users.messages.modify({
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

  async replyToEmail(userId: string, messageId: string, body: string): Promise<boolean> {
    try {
      const gmail = await this.getAuthenticatedGmailClient(userId);

      // Get original message to get thread ID and subject
      const originalMessage = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      });

      const headers = originalMessage.data.payload?.headers;
      const subject = headers?.find((h: any) => h.name === 'Subject')?.value || '';
      const from = headers?.find((h: any) => h.name === 'From')?.value || '';
      const threadId = originalMessage.data.threadId || undefined;

      const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;
      const message = this.createMessage(from, replySubject, body, threadId);

      const response = await gmail.users.messages.send({
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

  async draftEmail(userId: string, to: string, subject: string, body: string): Promise<string> {
    try {
      const gmail = await this.getAuthenticatedGmailClient(userId);

      const message = this.createMessage(to, subject, body);
      const response = await gmail.users.drafts.create({
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
    // Create proper RFC 2822 formatted email
    const boundary = 'boundary_' + Math.random().toString(36).substring(2);
    
    const messageParts = [
      `To: ${to}`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      threadId ? `In-Reply-To: ${threadId}` : '',
      threadId ? `References: ${threadId}` : '',
      '',
      `--${boundary}`,
      `Content-Type: text/plain; charset="UTF-8"`,
      `Content-Transfer-Encoding: quoted-printable`,
      '',
      body,
      '',
      `--${boundary}`,
      `Content-Type: text/html; charset="UTF-8"`,
      `Content-Transfer-Encoding: quoted-printable`,
      '',
      `<div>${body.replace(/\n/g, '<br>')}</div>`,
      '',
      `--${boundary}--`,
    ].filter(part => part !== null && part !== undefined);

    const message = messageParts.join('\r\n');
    
    // Encode to base64url (Gmail API format)
    return Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
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
