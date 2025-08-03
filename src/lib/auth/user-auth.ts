import { collection, doc, getDoc, setDoc, updateDoc, deleteDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { GoogleOAuthTokens, UserGoogleAuth } from './google-oauth';

export interface ConnectedAccount {
  id: string;
  userId: string;
  provider: 'google' | 'microsoft' | 'apple';
  email: string;
  scopes: string[];
  tokens: GoogleOAuthTokens; // Provider-specific token format
  connectedAt: Date;
  lastUsed: Date;
  isActive: boolean;
}

export interface UserPermissions {
  userId: string;
  email: boolean;
  calendar: boolean;
  contacts: boolean;
  sms: boolean;
  calls: boolean;
  connectedAccounts: ConnectedAccount[];
  updatedAt: Date;
}

class UserAuthService {
  private readonly COLLECTION_NAME = 'user_auth';
  private readonly ACCOUNTS_COLLECTION = 'connected_accounts';

  // Save Google OAuth tokens for a user
  async saveGoogleAuth(userId: string, tokens: GoogleOAuthTokens, email: string, scopes: string[]): Promise<void> {
    if (!db) {
      throw new Error('Firestore not initialized');
    }

    const userAuth: UserGoogleAuth = {
      userId,
      tokens,
      email,
      scopes,
      connectedAt: new Date(),
      lastUsed: new Date()
    };

    const connectedAccount: ConnectedAccount = {
      id: `google_${userId}`,
      userId,
      provider: 'google',
      email,
      scopes,
      tokens,
      connectedAt: new Date(),
      lastUsed: new Date(),
      isActive: true
    };

    try {
      // Save to user_auth collection
      await setDoc(doc(db, this.COLLECTION_NAME, userId), userAuth);
      
      // Save to connected_accounts collection
      await setDoc(doc(db, this.ACCOUNTS_COLLECTION, connectedAccount.id), connectedAccount);

      // Update user permissions
      await this.updateUserPermissions(userId);
      
      console.log('✅ Google auth saved for user:', userId);
    } catch (error) {
      console.error('❌ Error saving Google auth:', error);
      throw new Error('Failed to save Google authentication');
    }
  }

  // Get Google OAuth tokens for a user
  async getGoogleAuth(userId: string): Promise<UserGoogleAuth | null> {
    if (!db) {
      throw new Error('Firestore not initialized');
    }

    try {
      const docRef = doc(db, this.COLLECTION_NAME, userId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data() as UserGoogleAuth;
        // Update last used timestamp
        await updateDoc(docRef, { lastUsed: new Date() });
        return data;
      }

      return null;
    } catch (error) {
      console.error('❌ Error getting Google auth:', error);
      throw new Error('Failed to retrieve Google authentication');
    }
  }

  // Check if user has specific permissions
  async getUserPermissions(userId: string): Promise<UserPermissions | null> {
    if (!db) {
      throw new Error('Firestore not initialized');
    }

    try {
      // Get connected accounts for this user
      const accountsQuery = query(
        collection(db, this.ACCOUNTS_COLLECTION),
        where('userId', '==', userId),
        where('isActive', '==', true)
      );
      
      const accountsSnapshot = await getDocs(accountsQuery);
      const connectedAccounts: ConnectedAccount[] = [];
      
      accountsSnapshot.forEach((doc) => {
        connectedAccounts.push(doc.data() as ConnectedAccount);
      });

      // Determine permissions based on connected accounts
      const googleAccount = connectedAccounts.find(acc => acc.provider === 'google');
      const googleScopes = googleAccount?.scopes || [];

      const permissions: UserPermissions = {
        userId,
        email: googleScopes.includes('https://www.googleapis.com/auth/gmail.send'),
        calendar: googleScopes.includes('https://www.googleapis.com/auth/calendar'),
        contacts: googleScopes.includes('https://www.googleapis.com/auth/contacts.readonly'),
        sms: process.env.TWILIO_ACCOUNT_SID ? true : false, // SMS available if Twilio configured
        calls: process.env.TWILIO_ACCOUNT_SID ? true : false, // Calls available if Twilio configured
        connectedAccounts,
        updatedAt: new Date()
      };

      return permissions;
    } catch (error) {
      console.error('❌ Error getting user permissions:', error);
      return null;
    }
  }

  // Update user permissions cache
  private async updateUserPermissions(userId: string): Promise<void> {
    const permissions = await this.getUserPermissions(userId);
    if (permissions && db) {
      await setDoc(doc(db, 'user_permissions', userId), permissions);
    }
  }

  // Remove user's Google authentication
  async removeGoogleAuth(userId: string): Promise<void> {
    if (!db) {
      throw new Error('Firestore not initialized');
    }

    try {
      // Remove from user_auth collection
      await deleteDoc(doc(db, this.COLLECTION_NAME, userId));
      
      // Deactivate connected account
      const accountId = `google_${userId}`;
      const accountRef = doc(db, this.ACCOUNTS_COLLECTION, accountId);
      await updateDoc(accountRef, { isActive: false });

      // Update permissions
      await this.updateUserPermissions(userId);

      console.log('✅ Google auth removed for user:', userId);
    } catch (error) {
      console.error('❌ Error removing Google auth:', error);
      throw new Error('Failed to remove Google authentication');
    }
  }

  // Check if user has permission for a specific action
  async hasPermission(userId: string, permission: 'email' | 'calendar' | 'contacts' | 'sms' | 'calls'): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    return permissions ? permissions[permission] : false;
  }

  // Get all connected accounts for a user
  async getConnectedAccounts(userId: string): Promise<ConnectedAccount[]> {
    if (!db) {
      throw new Error('Firestore not initialized');
    }

    try {
      const accountsQuery = query(
        collection(db, this.ACCOUNTS_COLLECTION),
        where('userId', '==', userId),
        where('isActive', '==', true)
      );
      
      const accountsSnapshot = await getDocs(accountsQuery);
      const connectedAccounts: ConnectedAccount[] = [];
      
      accountsSnapshot.forEach((doc) => {
        connectedAccounts.push(doc.data() as ConnectedAccount);
      });

      return connectedAccounts;
    } catch (error) {
      console.error('❌ Error getting connected accounts:', error);
      return [];
    }
  }
}

export const userAuthService = new UserAuthService();
