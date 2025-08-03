import OpenAI from 'openai';

export interface AIService {
  generateResponse: (message: string, context?: ConversationContext) => Promise<string>;
  parseIntent: (message: string) => Promise<IntentResult>;
  generateEmailDraft: (recipient: string, subject: string, context: string) => Promise<string>;
  generateSMSMessage: (recipient: string, context: string) => Promise<string>;
  summarizeEmail: (emailContent: string) => Promise<string>;
  extractActionItems: (text: string) => Promise<ActionItem[]>;
}

export interface ConversationContext {
  userId: string;
  previousMessages: { role: 'user' | 'assistant'; content: string }[];
  userProfile?: {
    name: string;
    preferences: Record<string, unknown>;
  };
  currentTime: Date;
  timeZone: string;
}

export interface IntentResult {
  intent: string;
  confidence: number;
  entities: Record<string, unknown>;
  parameters: Record<string, unknown>;
  action?: string;
}

export interface ActionItem {
  task: string;
  priority: 'low' | 'medium' | 'high';
  dueDate?: Date;
  assignee?: string;
  category: string;
}

class AIServiceImpl implements AIService {
  private openai: OpenAI | null = null;
  private isInitialized = false;

  constructor() {
    this.initializeOpenAI();
  }

  private async initializeOpenAI() {
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      
      if (!apiKey) {
        console.warn('OpenAI API key not configured');
        return;
      }

      this.openai = new OpenAI({
        apiKey,
      });
      
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize OpenAI service:', error);
    }
  }

  private async ensureInitialized() {
    if (!this.isInitialized) {
      await this.initializeOpenAI();
    }
    if (!this.isInitialized || !this.openai) {
      throw new Error('OpenAI service not initialized');
    }
  }

  async generateResponse(message: string, context?: ConversationContext): Promise<string> {
    try {
      await this.ensureInitialized();

      // Simplified system prompt to reduce token usage
      const systemPrompt = "You are Jarwik, an AI assistant. Be helpful, concise, and friendly. Keep responses under 50 words unless more detail is specifically requested.";
      
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
      ];

      // Only include last 2 messages for context to reduce tokens
      if (context?.previousMessages && context.previousMessages.length > 0) {
        const recentMessages = context.previousMessages.slice(-2);
        recentMessages.forEach(msg => {
          messages.push({ role: msg.role, content: msg.content });
        });
      }

      // Add current message
      messages.push({ role: 'user', content: message });

      const response = await this.openai!.chat.completions.create({
        model: 'gpt-3.5-turbo', // Much cheaper than GPT-4
        messages,
        max_tokens: 100, // Reduced from 500
        temperature: 0.7,
      });

      return response.choices[0]?.message?.content || 'I apologize, but I couldn\'t generate a response at the moment.';
    } catch (error) {
      console.error('Failed to generate AI response:', error);
      return 'I\'m having trouble processing your request right now. Please try again later.';
    }
  }

  async parseIntent(message: string): Promise<IntentResult> {
    try {
      await this.ensureInitialized();

      // Simplified, shorter prompt for faster and cheaper processing
      const prompt = `Parse this message into JSON with intent, confidence, entities, parameters:
"${message}"

Return format: {"intent":"send_email|set_reminder|create_event|send_sms|general_chat","confidence":0.8,"entities":{},"parameters":{}}

Examples:
- Email: {"intent":"send_email","confidence":0.9,"entities":{"email":"john@test.com"},"parameters":{"to":"john@test.com","subject":"Hello","body":"Hi there"}}
- Reminder: {"intent":"set_reminder","confidence":0.9,"entities":{"time":"20 minutes"},"parameters":{"reminder":"task","time":"20 minutes"}}`;

      const response = await this.openai!.chat.completions.create({
        model: 'gpt-3.5-turbo', // Cheaper than GPT-4
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 150, // Reduced tokens
        temperature: 0.1,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      try {
        return JSON.parse(content);
      } catch {
        // Fallback if JSON parsing fails
        return {
          intent: 'general_chat',
          confidence: 0.5,
          entities: {},
          parameters: { query: message },
        };
      }
    } catch (error) {
      console.error('Failed to parse intent:', error);
      return {
        intent: 'general_chat',
        confidence: 0.5,
        entities: {},
        parameters: { query: message },
      };
    }
  }

  async generateEmailDraft(recipient: string, subject: string, context: string): Promise<string> {
    try {
      await this.ensureInitialized();

      const prompt = `
      Write a professional email with the following details:
      - Recipient: ${recipient}
      - Subject: ${subject}
      - Context/Purpose: ${context}

      Please write a clear, concise, and professional email body. Do not include the subject line or recipient in the response, just the email body.
      `;

      const response = await this.openai!.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300,
        temperature: 0.7,
      });

      return response.choices[0]?.message?.content || 'Unable to generate email content.';
    } catch (error) {
      console.error('Failed to generate email draft:', error);
      return 'Unable to generate email content at this time.';
    }
  }

  async generateSMSMessage(recipient: string, context: string): Promise<string> {
    try {
      await this.ensureInitialized();

      const prompt = `
      Write a brief, friendly text message for:
      - Recipient: ${recipient}
      - Context/Purpose: ${context}

      Keep it under 160 characters, casual but respectful. Just return the message text.
      `;

      const response = await this.openai!.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 100,
        temperature: 0.7,
      });

      return response.choices[0]?.message?.content || 'Unable to generate message.';
    } catch (error) {
      console.error('Failed to generate SMS message:', error);
      return 'Unable to generate message at this time.';
    }
  }

  async summarizeEmail(emailContent: string): Promise<string> {
    try {
      await this.ensureInitialized();

      const prompt = `
      Please provide a brief summary of the following email content:

      ${emailContent}

      Summarize the key points in 1-2 sentences:
      `;

      const response = await this.openai!.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 150,
        temperature: 0.5,
      });

      return response.choices[0]?.message?.content || 'Unable to summarize email.';
    } catch (error) {
      console.error('Failed to summarize email:', error);
      return 'Unable to summarize email at this time.';
    }
  }

  async extractActionItems(text: string): Promise<ActionItem[]> {
    try {
      await this.ensureInitialized();

      const prompt = `
      Extract action items from the following text and return them as a JSON array:

      ${text}

      For each action item, include:
      - task: The task description
      - priority: "low", "medium", or "high"
      - dueDate: ISO date string if mentioned (or null)
      - assignee: Person assigned (or null)
      - category: General category like "work", "personal", "meeting", etc.

      Example: [{"task": "Send report to client", "priority": "high", "dueDate": "2024-01-15T00:00:00.000Z", "assignee": "John", "category": "work"}]
      `;

      const response = await this.openai!.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300,
        temperature: 0.3,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return [];
      }

      try {
        return JSON.parse(content);
      } catch {
        return [];
      }
    } catch (error) {
      console.error('Failed to extract action items:', error);
      return [];
    }
  }

  private buildSystemPrompt(context?: ConversationContext): string {
    const currentTime = context?.currentTime || new Date();
    const timeZone = context?.timeZone || 'UTC';
    const userName = context?.userProfile?.name || 'there';

    return `
    You are Jarwik, an intelligent personal assistant. You help users with:
    - Sending emails and text messages
    - Scheduling meetings and events
    - Managing tasks and reminders
    - Making phone calls
    - Searching contacts
    - General conversation and information

    Current time: ${currentTime.toISOString()}
    Timezone: ${timeZone}
    User: ${userName}

    Be helpful, friendly, and efficient. When users ask you to perform actions:
    1. Confirm the details
    2. Ask for clarification if needed
    3. Execute the action
    4. Provide clear feedback

    For scheduling and time-related tasks, always consider the user's timezone.
    Be proactive in suggesting optimal solutions.
    `;
  }
}

// Export singleton instance
export const aiService = new AIServiceImpl();
