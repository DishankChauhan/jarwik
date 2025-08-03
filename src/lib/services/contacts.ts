import { google } from 'googleapis';

export interface ContactsService {
  getContacts: (query?: string, maxResults?: number) => Promise<Contact[]>;
  createContact: (contact: ContactInput) => Promise<Contact | null>;
  updateContact: (contactId: string, updates: Partial<ContactInput>) => Promise<boolean>;
  deleteContact: (contactId: string) => Promise<boolean>;
  searchContacts: (query: string) => Promise<Contact[]>;
  getContactByEmail: (email: string) => Promise<Contact | null>;
  getContactByPhone: (phone: string) => Promise<Contact | null>;
}

export interface ContactInput {
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  notes?: string;
}

export interface Contact {
  id: string;
  firstName: string;
  lastName?: string;
  fullName: string;
  email?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  notes?: string;
  photoUrl?: string;
  lastContacted?: Date;
  createdAt: Date;
  updatedAt: Date;
}

class ContactsServiceImpl implements ContactsService {
  private people: any;
  private isInitialized = false;

  constructor() {
    this.initializeContacts();
  }

  private async initializeContacts() {
    try {
      // Use API key for simpler setup (read-only access)
      this.people = google.people({ 
        version: 'v1', 
        auth: process.env.GOOGLE_API_KEY 
      });
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize Contacts service:', error);
    }
  }

  private async ensureInitialized() {
    if (!this.isInitialized) {
      await this.initializeContacts();
    }
    if (!this.isInitialized) {
      throw new Error('Contacts service not initialized');
    }
  }

  async getContacts(query?: string, maxResults: number = 100): Promise<Contact[]> {
    try {
      await this.ensureInitialized();

      const response = await this.people.people.connections.list({
        resourceName: 'people/me',
        pageSize: maxResults,
        personFields: 'names,emailAddresses,phoneNumbers,organizations,photos,metadata',
      });

      let contacts = response.data.connections?.map((person: any) => this.parseContact(person)).filter(Boolean) || [];

      // Apply text search filter if query provided
      if (query) {
        const searchTerm = query.toLowerCase();
        contacts = contacts.filter((contact: Contact) =>
          contact.fullName.toLowerCase().includes(searchTerm) ||
          contact.email?.toLowerCase().includes(searchTerm) ||
          contact.phone?.includes(searchTerm) ||
          contact.company?.toLowerCase().includes(searchTerm)
        );
      }

      return contacts;
    } catch (error) {
      console.error('Failed to get contacts:', error);
      return [];
    }
  }

  async createContact(contactInput: ContactInput): Promise<Contact | null> {
    try {
      await this.ensureInitialized();

      const person: any = {
        names: [{
          givenName: contactInput.firstName,
          familyName: contactInput.lastName || '',
        }],
      };

      if (contactInput.email) {
        person.emailAddresses = [{ value: contactInput.email }];
      }

      if (contactInput.phone) {
        person.phoneNumbers = [{ value: contactInput.phone }];
      }

      if (contactInput.company || contactInput.jobTitle) {
        person.organizations = [{
          name: contactInput.company || '',
          title: contactInput.jobTitle || '',
        }];
      }

      if (contactInput.notes) {
        person.biographies = [{ value: contactInput.notes }];
      }

      const response = await this.people.people.createContact({
        requestBody: person,
      });

      return this.parseContact(response.data);
    } catch (error) {
      console.error('Failed to create contact:', error);
      return null;
    }
  }

  async updateContact(contactId: string, updates: Partial<ContactInput>): Promise<boolean> {
    try {
      await this.ensureInitialized();

      // Get current contact data
      const currentContact = await this.people.people.get({
        resourceName: `people/${contactId}`,
        personFields: 'names,emailAddresses,phoneNumbers,organizations,biographies,metadata',
      });

      const person: any = { ...currentContact.data };

      // Update fields
      if (updates.firstName || updates.lastName) {
        person.names = [{
          givenName: updates.firstName || person.names?.[0]?.givenName || '',
          familyName: updates.lastName || person.names?.[0]?.familyName || '',
        }];
      }

      if (updates.email) {
        person.emailAddresses = [{ value: updates.email }];
      }

      if (updates.phone) {
        person.phoneNumbers = [{ value: updates.phone }];
      }

      if (updates.company || updates.jobTitle) {
        person.organizations = [{
          name: updates.company || person.organizations?.[0]?.name || '',
          title: updates.jobTitle || person.organizations?.[0]?.title || '',
        }];
      }

      if (updates.notes) {
        person.biographies = [{ value: updates.notes }];
      }

      await this.people.people.updateContact({
        resourceName: `people/${contactId}`,
        updatePersonFields: 'names,emailAddresses,phoneNumbers,organizations,biographies',
        requestBody: person,
      });

      return true;
    } catch (error) {
      console.error('Failed to update contact:', error);
      return false;
    }
  }

  async deleteContact(contactId: string): Promise<boolean> {
    try {
      await this.ensureInitialized();

      await this.people.people.deleteContact({
        resourceName: `people/${contactId}`,
      });

      return true;
    } catch (error) {
      console.error('Failed to delete contact:', error);
      return false;
    }
  }

  async searchContacts(query: string): Promise<Contact[]> {
    return this.getContacts(query);
  }

  async getContactByEmail(email: string): Promise<Contact | null> {
    try {
      const contacts = await this.getContacts();
      return contacts.find(contact => contact.email?.toLowerCase() === email.toLowerCase()) || null;
    } catch (error) {
      console.error('Failed to get contact by email:', error);
      return null;
    }
  }

  async getContactByPhone(phone: string): Promise<Contact | null> {
    try {
      const contacts = await this.getContacts();
      const cleanPhone = phone.replace(/\D/g, '');
      return contacts.find(contact => 
        contact.phone?.replace(/\D/g, '').includes(cleanPhone) ||
        cleanPhone.includes(contact.phone?.replace(/\D/g, '') || '')
      ) || null;
    } catch (error) {
      console.error('Failed to get contact by phone:', error);
      return null;
    }
  }

  private parseContact(person: any): Contact | null {
    try {
      const id = person.resourceName?.replace('people/', '') || '';
      const name = person.names?.[0];
      const email = person.emailAddresses?.[0]?.value;
      const phone = person.phoneNumbers?.[0]?.value;
      const organization = person.organizations?.[0];
      const photo = person.photos?.[0]?.url;
      const notes = person.biographies?.[0]?.value;
      const metadata = person.metadata;

      const firstName = name?.givenName || '';
      const lastName = name?.familyName || '';
      const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'Unknown Contact';

      return {
        id,
        firstName,
        lastName,
        fullName,
        email,
        phone,
        company: organization?.name,
        jobTitle: organization?.title,
        notes,
        photoUrl: photo,
        createdAt: metadata?.sources?.[0]?.updateTime ? new Date(metadata.sources[0].updateTime) : new Date(),
        updatedAt: metadata?.sources?.[0]?.updateTime ? new Date(metadata.sources[0].updateTime) : new Date(),
      };
    } catch (error) {
      console.error('Failed to parse contact:', error);
      return null;
    }
  }
}

// Export singleton instance
export const contactsService = new ContactsServiceImpl();
