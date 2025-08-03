import { NextRequest, NextResponse } from 'next/server';
import { googleOAuthService } from '@/lib/auth/google-oauth';
import { userAuthService } from '@/lib/auth/user-auth';

export async function POST(req: NextRequest) {
  try {
    const { userId, service } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    let authUrl: string;

    switch (service) {
      case 'gmail':
        authUrl = googleOAuthService.getGmailAuthUrl(userId);
        break;
      case 'calendar':
        authUrl = googleOAuthService.getCalendarAuthUrl(userId);
        break;
      case 'contacts':
        authUrl = googleOAuthService.getContactsAuthUrl(userId);
        break;
      case 'all':
      default:
        authUrl = googleOAuthService.getAllServicesAuthUrl(userId);
        break;
    }

    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate authorization URL' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Get user's current permissions and connected accounts
    const permissions = await userAuthService.getUserPermissions(userId);
    const connectedAccounts = await userAuthService.getConnectedAccounts(userId);

    return NextResponse.json({
      permissions,
      connectedAccounts,
      hasGoogleAuth: !!permissions?.email || !!permissions?.calendar || !!permissions?.contacts,
      capabilities: {
        email: permissions?.email || false,
        calendar: permissions?.calendar || false,
        contacts: permissions?.contacts || false,
        sms: permissions?.sms || false,
        calls: permissions?.calls || false,
      }
    });
  } catch (error) {
    console.error('Error getting user permissions:', error);
    return NextResponse.json(
      { error: 'Failed to get user permissions' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { userId, provider } = await req.json();

    if (!userId || !provider) {
      return NextResponse.json({ error: 'User ID and provider are required' }, { status: 400 });
    }

    if (provider === 'google') {
      await userAuthService.removeGoogleAuth(userId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing auth:', error);
    return NextResponse.json(
      { error: 'Failed to remove authentication' },
      { status: 500 }
    );
  }
}
