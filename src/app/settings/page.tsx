'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import ProtectedRoute from '@/components/ProtectedRoute';
import PhoneNumberManager from '@/components/PhoneNumberManager';

interface ConnectedAccount {
  id: string;
  provider: string;
  email: string;
  scopes: string[];
  connectedAt: string;
  isActive: boolean;
}

interface UserPermissions {
  email: boolean;
  calendar: boolean;
  contacts: boolean;
  sms: boolean;
  calls: boolean;
}

export default function SettingsPage() {
  return (
    <ProtectedRoute>
      <SettingsContent />
    </ProtectedRoute>
  );
}

function SettingsContent() {
  const { user, signOut } = useAuth();
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccount[]>([]);
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = useCallback(async () => {
    if (!user?.uid) return;
    
    try {
      const response = await fetch(`/api/auth/connect?userId=${user.uid}`);
      const data = await response.json();
      
      setConnectedAccounts(data.connectedAccounts || []);
      setPermissions(data.capabilities || null);
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  const connectGoogleServices = async () => {
    if (!user?.uid) return;
    
    try {
      const response = await fetch('/api/auth/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid, service: 'all' })
      });
      const data = await response.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (error) {
      console.error('Error initiating Google OAuth:', error);
    }
  };

  const disconnectGoogle = async () => {
    if (!user?.uid) return;
    
    try {
      await fetch('/api/auth/connect', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid, provider: 'google' })
      });
      await fetchUserData();
    } catch (error) {
      console.error('Error disconnecting Google:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="p-6">
          <div className="animate-pulse">Loading settings...</div>
        </div>
      </div>
    );
  }

  const hasGoogleConnection = connectedAccounts.some(acc => acc.provider === 'google' && acc.isActive);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <a href="/dashboard" className="text-xl font-bold text-gray-900">
                Jarwik
              </a>
            </div>
            <div className="flex items-center space-x-4">
              <a href="/dashboard" className="text-gray-600 hover:text-gray-900">
                Dashboard
              </a>
              <button
                onClick={signOut}
                className="text-gray-600 hover:text-gray-900"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Settings</h1>

        {/* Connected Accounts Section */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Connected Accounts</h2>
          <p className="text-gray-600 mb-6">
            Connect your accounts to enable Jarwik to perform actions on your behalf.
          </p>

          {/* Google Services */}
          <div className="border rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <span className="text-red-600 font-semibold">G</span>
                </div>
                <div>
                  <h3 className="font-medium">Google Services</h3>
                  <p className="text-sm text-gray-500">
                    Gmail, Calendar, and Contacts
                  </p>
                </div>
              </div>
              
              {hasGoogleConnection ? (
                <div className="flex items-center space-x-3">
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                    Connected
                  </span>
                  <button
                    onClick={disconnectGoogle}
                    className="text-red-600 hover:text-red-700 text-sm font-medium"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <button
                  onClick={connectGoogleServices}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
                >
                  Connect Google
                </button>
              )}
            </div>

            {hasGoogleConnection && (
              <div className="mt-4 pl-13">
                <h4 className="text-sm font-medium mb-2">Permissions:</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                  <div className={`flex items-center space-x-2 ${permissions?.email ? 'text-green-600' : 'text-gray-400'}`}>
                    <span>{permissions?.email ? '✅' : '❌'}</span>
                    <span>Send Emails</span>
                  </div>
                  <div className={`flex items-center space-x-2 ${permissions?.calendar ? 'text-green-600' : 'text-gray-400'}`}>
                    <span>{permissions?.calendar ? '✅' : '❌'}</span>
                    <span>Calendar Events</span>
                  </div>
                  <div className={`flex items-center space-x-2 ${permissions?.contacts ? 'text-green-600' : 'text-gray-400'}`}>
                    <span>{permissions?.contacts ? '✅' : '❌'}</span>
                    <span>Contacts</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Twilio Services */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <span className="text-purple-600 font-semibold">T</span>
                </div>
                <div>
                  <h3 className="font-medium">Twilio Services</h3>
                  <p className="text-sm text-gray-500">
                    SMS and Voice Calls
                  </p>
                </div>
              </div>
              
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                permissions?.sms || permissions?.calls 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {permissions?.sms || permissions?.calls ? 'Configured' : 'Not Configured'}
              </span>
            </div>

            {(permissions?.sms || permissions?.calls) && (
              <div className="mt-4 pl-13">
                <h4 className="text-sm font-medium mb-2">Available:</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className={`flex items-center space-x-2 ${permissions?.sms ? 'text-green-600' : 'text-gray-400'}`}>
                    <span>{permissions?.sms ? '✅' : '❌'}</span>
                    <span>Send SMS</span>
                  </div>
                  <div className={`flex items-center space-x-2 ${permissions?.calls ? 'text-green-600' : 'text-gray-400'}`}>
                    <span>{permissions?.calls ? '✅' : '❌'}</span>
                    <span>Make Calls</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* AI Settings Section */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-xl font-semibold mb-4">AI Assistant Settings</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Voice Agent</h3>
                <p className="text-sm text-gray-500">
                  Powered by ElevenLabs with real-time action execution
                </p>
              </div>
              <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                Active
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Chat Interface</h3>
                <p className="text-sm text-gray-500">
                  Text-based interaction with AI assistant
                </p>
              </div>
              <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                Active
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Real-time Actions</h3>
                <p className="text-sm text-gray-500">
                  Execute emails, SMS, calls, and calendar events immediately
                </p>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                hasGoogleConnection 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {hasGoogleConnection ? 'Enabled' : 'Needs Google Connection'}
              </span>
            </div>
          </div>
        </div>

        {/* SMS Settings Section */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">SMS Integration</h2>
          <p className="text-gray-600 mb-4">
            Connect your phone number to text Jarwik directly for scheduling, emails, and more.
          </p>
          
          {/* Central Number Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-blue-600 font-semibold">📱</span>
              </div>
              <div>
                <h3 className="font-medium text-blue-900">Text Jarwik at:</h3>
                <p className="text-2xl font-mono font-bold text-blue-700">+12672147419</p>
                <p className="text-sm text-blue-600">No app needed - just text this number!</p>
              </div>
            </div>
          </div>

          <PhoneNumberManager userId={user?.uid} />
        </div>

        {/* Usage Instructions */}
        {hasGoogleConnection && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-8">
            <h3 className="font-medium text-blue-900 mb-2">🎉 You&apos;re all set!</h3>
            <p className="text-blue-700 mb-3">
              Jarwik can now perform real actions on your behalf. Try these commands:
            </p>
            <ul className="text-sm text-blue-600 space-y-1">
              <li>• &quot;Send an email to apoorv107@gmail.com about our meeting tomorrow&quot;</li>
              <li>• &quot;Schedule a call with Sarah at 3 PM today&quot;</li>
              <li>• &quot;Create a calendar event for team standup at 9 AM Monday&quot;</li>
              <li>• &quot;Am I free on Friday?&quot;</li>
              <li>• &quot;What&apos;s my schedule today?&quot;</li>
            </ul>
            <div className="mt-3 p-3 bg-blue-100 rounded-lg">
              <p className="text-sm font-semibold text-blue-900">📱 Text these commands to: +12672147419</p>
            </div>
          </div>
        )}

        {!hasGoogleConnection && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mt-8">
            <h3 className="font-medium text-yellow-900 mb-2">🔗 Connect Your Accounts</h3>
            <p className="text-yellow-700 mb-3">
              To enable real actions, connect your Google account to grant Jarwik access to Gmail, Calendar, and Contacts.
            </p>
            <button
              onClick={connectGoogleServices}
              className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 font-medium"
            >
              Connect Google Services
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
