import { NextRequest, NextResponse } from 'next/server';
import { googleOAuthService } from '@/lib/auth/google-oauth';
import { userAuthService } from '@/lib/auth/user-auth';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // This contains the userId
    const error = searchParams.get('error');

    if (error) {
      console.error('OAuth error:', error);
      return NextResponse.redirect(new URL('/dashboard?error=oauth_denied', req.url));
    }

    if (!code || !state) {
      console.error('Missing authorization code or state');
      return NextResponse.redirect(new URL('/dashboard?error=oauth_invalid', req.url));
    }

    const userId = state;

    try {
      // Exchange authorization code for tokens
      const tokens = await googleOAuthService.exchangeCodeForTokens(code);
      
      // Get user info to extract email
      const authClient = googleOAuthService.getAuthenticatedClient(tokens);
      
      // Use the auth client directly to get user info
      const userInfoResponse = await authClient.request({
        url: 'https://www.googleapis.com/oauth2/v2/userinfo'
      });
      
      const email = (userInfoResponse.data as { email?: string })?.email;
      if (!email) {
        throw new Error('Could not retrieve user email');
      }

      // Determine scopes from tokens
      const scopes = tokens.scope ? tokens.scope.split(' ') : [];

      // Save authentication data
      await userAuthService.saveGoogleAuth(userId, tokens, email, scopes);

      console.log('✅ Google OAuth completed for user:', userId);
      
      // Redirect back to dashboard with success
      return NextResponse.redirect(new URL('/dashboard?connected=google', req.url));
      
    } catch (authError) {
      console.error('Error processing OAuth callback:', authError);
      return NextResponse.redirect(new URL('/dashboard?error=oauth_failed', req.url));
    }
  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect(new URL('/dashboard?error=oauth_error', req.url));
  }
}
