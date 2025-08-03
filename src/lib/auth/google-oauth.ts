import { google } from 'googleapis';

export interface GoogleOAuthTokens {
  access_token: string;
  refresh_token: string;
  scope: string;
  token_type: string;
  expiry_date: number;
}

export interface UserGoogleAuth {
  userId: string;
  tokens: GoogleOAuthTokens;
  email: string;
  scopes: string[];
  connectedAt: Date;
  lastUsed: Date;
}

class GoogleOAuthService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private oauth2Client: any;
  
  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback'
    );
  }

  // Generate the URL for Google OAuth consent screen
  getAuthUrl(userId: string, scopes: string[] = []): string {
    const defaultScopes = [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ];

    const requestedScopes = [
      ...defaultScopes,
      ...scopes
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: requestedScopes,
      state: userId, // Pass userId to identify the user after callback
      prompt: 'consent', // Force consent screen to get refresh token
    });
  }

  // Exchange authorization code for tokens
  async exchangeCodeForTokens(code: string): Promise<GoogleOAuthTokens> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      return tokens as GoogleOAuthTokens;
    } catch (error) {
      console.error('Error exchanging code for tokens:', error);
      throw new Error('Failed to exchange authorization code for tokens');
    }
  }

  // Get authenticated client for API calls
  getAuthenticatedClient(tokens: GoogleOAuthTokens) {
    this.oauth2Client.setCredentials(tokens);
    return this.oauth2Client;
  }

  // Refresh expired tokens
  async refreshTokens(refreshToken: string): Promise<GoogleOAuthTokens> {
    try {
      this.oauth2Client.setCredentials({
        refresh_token: refreshToken
      });
      
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      return credentials as GoogleOAuthTokens;
    } catch (error) {
      console.error('Error refreshing tokens:', error);
      throw new Error('Failed to refresh access tokens');
    }
  }

  // Check if tokens are expired and refresh if needed
  async ensureValidTokens(tokens: GoogleOAuthTokens): Promise<GoogleOAuthTokens> {
    const now = Date.now();
    const expiry = tokens.expiry_date;
    
    // If tokens expire in less than 5 minutes, refresh them
    if (expiry && now > (expiry - 5 * 60 * 1000)) {
      if (!tokens.refresh_token) {
        throw new Error('No refresh token available. User needs to re-authenticate.');
      }
      return await this.refreshTokens(tokens.refresh_token);
    }
    
    return tokens;
  }

  // Get specific scoped auth URLs
  getGmailAuthUrl(userId: string): string {
    return this.getAuthUrl(userId, [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify'
    ]);
  }

  getCalendarAuthUrl(userId: string): string {
    return this.getAuthUrl(userId, [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events'
    ]);
  }

  getContactsAuthUrl(userId: string): string {
    return this.getAuthUrl(userId, [
      'https://www.googleapis.com/auth/contacts.readonly',
      'https://www.googleapis.com/auth/contacts'
    ]);
  }

  getAllServicesAuthUrl(userId: string): string {
    return this.getAuthUrl(userId, [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/contacts.readonly',
      'https://www.googleapis.com/auth/contacts'
    ]);
  }
}

export const googleOAuthService = new GoogleOAuthService();
