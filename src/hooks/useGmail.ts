import { useState, useCallback } from 'react';
import type { EmailMessage } from '@/lib/services';

export function useGmail() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendEmail = useCallback(async (to: string, subject: string, body: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/gmail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', to, subject, body }),
      });
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }
      
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send email');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const getEmails = useCallback(async (query?: string, maxResults?: number): Promise<EmailMessage[]> => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query) params.append('query', query);
      if (maxResults) params.append('maxResults', maxResults.toString());
      
      const response = await fetch(`/api/gmail?${params}`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error);
      }
      
      return data.data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch emails');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const replyToEmail = useCallback(async (messageId: string, body: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/gmail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reply', messageId, body }),
      });
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }
      
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reply to email');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const createDraft = useCallback(async (to: string, subject: string, body: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/gmail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'draft', to, subject, body }),
      });
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }
      
      return data.draftId;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create draft');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const markAsRead = useCallback(async (messageId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/gmail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'markAsRead', messageId }),
      });
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }
      
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark email as read');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    sendEmail,
    getEmails,
    replyToEmail,
    createDraft,
    markAsRead,
    loading,
    error,
  };
}
