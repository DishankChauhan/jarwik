import { useState, useCallback } from 'react';
import type { SMSMessage, CallLog } from '@/lib/services';

export function useTwilio() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendSMS = useCallback(async (to: string, message: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/twilio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sendSMS', to, message }),
      });
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }
      
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send SMS');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const makeCall = useCallback(async (to: string, message: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/twilio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'makeCall', to, message }),
      });
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }
      
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to make call');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const getMessages = useCallback(async (limit?: number): Promise<SMSMessage[]> => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append('type', 'messages');
      if (limit) params.append('limit', limit.toString());
      
      const response = await fetch(`/api/twilio?${params}`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error);
      }
      
      return data.data.map((message: any) => ({
        ...message,
        dateCreated: new Date(message.dateCreated),
        dateSent: message.dateSent ? new Date(message.dateSent) : undefined,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch messages');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const getCallLogs = useCallback(async (limit?: number): Promise<CallLog[]> => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append('type', 'calls');
      if (limit) params.append('limit', limit.toString());
      
      const response = await fetch(`/api/twilio?${params}`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error);
      }
      
      return data.data.map((call: any) => ({
        ...call,
        startTime: call.startTime ? new Date(call.startTime) : undefined,
        endTime: call.endTime ? new Date(call.endTime) : undefined,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch call logs');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    sendSMS,
    makeCall,
    getMessages,
    getCallLogs,
    loading,
    error,
  };
}
