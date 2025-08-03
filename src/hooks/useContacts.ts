import { useState, useCallback } from 'react';
import type { Contact, ContactInput } from '@/lib/services';

export function useContacts() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getContacts = useCallback(async (query?: string, maxResults?: number): Promise<Contact[]> => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query) params.append('query', query);
      if (maxResults) params.append('maxResults', maxResults.toString());
      
      const response = await fetch(`/api/contacts?${params}`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error);
      }
      
      return data.data.map((contact: any) => ({
        ...contact,
        createdAt: new Date(contact.createdAt),
        updatedAt: new Date(contact.updatedAt),
        lastContacted: contact.lastContacted ? new Date(contact.lastContacted) : undefined,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch contacts');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const createContact = useCallback(async (contactData: ContactInput) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', ...contactData }),
      });
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }
      
      return data.data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create contact');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateContact = useCallback(async (contactId: string, updates: Partial<ContactInput>) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', contactId, ...updates }),
      });
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }
      
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update contact');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteContact = useCallback(async (contactId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', contactId }),
      });
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }
      
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete contact');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const searchContacts = useCallback(async (query: string): Promise<Contact[]> => {
    return getContacts(query);
  }, [getContacts]);

  const getContactByEmail = useCallback(async (email: string): Promise<Contact | null> => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append('email', email);
      
      const response = await fetch(`/api/contacts?${params}`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error);
      }
      
      return data.data ? {
        ...data.data,
        createdAt: new Date(data.data.createdAt),
        updatedAt: new Date(data.data.updatedAt),
        lastContacted: data.data.lastContacted ? new Date(data.data.lastContacted) : undefined,
      } : null;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch contact');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const getContactByPhone = useCallback(async (phone: string): Promise<Contact | null> => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append('phone', phone);
      
      const response = await fetch(`/api/contacts?${params}`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error);
      }
      
      return data.data ? {
        ...data.data,
        createdAt: new Date(data.data.createdAt),
        updatedAt: new Date(data.data.updatedAt),
        lastContacted: data.data.lastContacted ? new Date(data.data.lastContacted) : undefined,
      } : null;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch contact');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    getContacts,
    createContact,
    updateContact,
    deleteContact,
    searchContacts,
    getContactByEmail,
    getContactByPhone,
    loading,
    error,
  };
}
