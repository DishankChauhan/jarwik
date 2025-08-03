import { useState, useCallback } from 'react';
import type { ConversationContext, IntentResult, ActionItem } from '@/lib/services';

export function useAI() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateResponse = useCallback(async (message: string, context?: ConversationContext) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'generateResponse', 
          message, 
          context: context ? {
            ...context,
            currentTime: context.currentTime.toISOString(),
          } : undefined,
        }),
      });
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }
      
      return data.response;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate response');
      return 'I apologize, but I\'m having trouble responding right now. Please try again.';
    } finally {
      setLoading(false);
    }
  }, []);

  const parseIntent = useCallback(async (message: string): Promise<IntentResult> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'parseIntent', message }),
      });
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }
      
      return data.intent;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse intent');
      return {
        intent: 'general_chat',
        confidence: 0.5,
        entities: {},
        parameters: { query: message },
      };
    } finally {
      setLoading(false);
    }
  }, []);

  const generateEmailDraft = useCallback(async (recipient: string, subject: string, context: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'generateEmailDraft', 
          recipient, 
          subject, 
          context 
        }),
      });
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }
      
      return data.draft;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate email draft');
      return 'Unable to generate email content at this time.';
    } finally {
      setLoading(false);
    }
  }, []);

  const generateSMSMessage = useCallback(async (recipient: string, context: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'generateSMSMessage', 
          recipient, 
          context 
        }),
      });
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }
      
      return data.message;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate SMS message');
      return 'Unable to generate message at this time.';
    } finally {
      setLoading(false);
    }
  }, []);

  const summarizeEmail = useCallback(async (emailContent: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'summarizeEmail', emailContent }),
      });
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }
      
      return data.summary;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to summarize email');
      return 'Unable to summarize email at this time.';
    } finally {
      setLoading(false);
    }
  }, []);

  const extractActionItems = useCallback(async (text: string): Promise<ActionItem[]> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'extractActionItems', text }),
      });
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }
      
      return data.actionItems.map((item: any) => ({
        task: item.task,
        priority: item.priority,
        category: item.category,
        assignee: item.assignee,
        dueDate: item.dueDate ? new Date(item.dueDate) : undefined,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extract action items');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    generateResponse,
    parseIntent,
    generateEmailDraft,
    generateSMSMessage,
    summarizeEmail,
    extractActionItems,
    loading,
    error,
  };
}
