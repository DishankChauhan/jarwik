import { NextRequest, NextResponse } from 'next/server';
import { userAuthService } from '@/lib/auth/user-auth';
import { twilioService } from '@/lib/services';

export async function POST(req: NextRequest) {
  try {
    const { userId, phoneNumber, action } = await req.json();

    if (!userId || !phoneNumber) {
      return NextResponse.json({ 
        error: 'Missing required fields: userId and phoneNumber' 
      }, { status: 400 });
    }

    switch (action) {
      case 'add':
        await userAuthService.addPhoneNumber(userId, phoneNumber);
        
        // Send welcome SMS
        const welcomeMessage = `🎉 Welcome to Jarwik! Your phone number has been connected. You can now:
• Send emails: "Send email to john@example.com about meeting"
• Schedule events: "Schedule meeting tomorrow at 2pm"
• Check availability: "Am I free on Friday?"

Try texting me something!`;
        
        await twilioService.sendSMS(phoneNumber, welcomeMessage);
        
        return NextResponse.json({ 
          success: true, 
          message: 'Phone number added successfully. Welcome SMS sent!' 
        });

      case 'verify':
        const verified = await userAuthService.verifyPhoneNumber(phoneNumber);
        return NextResponse.json({ 
          success: verified, 
          message: verified ? 'Phone number verified' : 'Verification failed' 
        });

      case 'remove':
        const removed = await userAuthService.removePhoneNumber(phoneNumber);
        return NextResponse.json({ 
          success: removed, 
          message: removed ? 'Phone number removed' : 'Removal failed' 
        });

      default:
        return NextResponse.json({ 
          error: 'Invalid action. Use: add, verify, or remove' 
        }, { status: 400 });
    }

  } catch (error) {
    console.error('❌ Phone number management error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const phoneNumber = searchParams.get('phoneNumber');

    if (phoneNumber) {
      // Check if phone number is connected to any user
      const connectedUserId = await userAuthService.getUserByPhoneNumber(phoneNumber);
      return NextResponse.json({ 
        connected: !!connectedUserId,
        userId: connectedUserId 
      });
    }

    if (userId) {
      // Get all phone numbers for a user (implement this method if needed)
      return NextResponse.json({ 
        message: 'Phone number lookup for user not implemented yet' 
      });
    }

    return NextResponse.json({ 
      error: 'Missing phoneNumber parameter' 
    }, { status: 400 });

  } catch (error) {
    console.error('❌ Phone number lookup error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
