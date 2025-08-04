'use client';

import { useState, useEffect, useCallback } from 'react';

interface PhoneNumberManagerProps {
  userId?: string;
}

export default function PhoneNumberManager({ userId }: PhoneNumberManagerProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');

  const checkPhoneStatus = useCallback(async () => {
    if (!userId) return;
    
    // This would require implementing a method to get user's phone numbers
    // For now, we'll just reset the state
    setIsConnected(false);
  }, [userId]);

  useEffect(() => {
    // Check if user already has a phone number connected
    checkPhoneStatus();
  }, [checkPhoneStatus]);

  const showMessage = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => setMessage(''), 5000);
  };

  const formatPhoneNumber = (value: string) => {
    // Keep the + sign and allow international numbers
    if (value.startsWith('+')) {
      // Allow + followed by digits and spaces
      return value.replace(/[^\d\s+]/g, '');
    }
    
    // If no +, assume it might be a local number, keep digits and spaces
    return value.replace(/[^\d\s]/g, '');
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhoneNumber(formatted);
  };

  const handleAddPhone = async () => {
    if (!userId || !phoneNumber) {
      showMessage('Please enter a valid phone number', 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/phone-management', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          phoneNumber,
          action: 'add'
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setIsConnected(true);
        showMessage('Phone number connected successfully! Check your phone for a welcome message.', 'success');
      } else {
        showMessage(data.message || 'Failed to connect phone number', 'error');
      }
    } catch (error) {
      console.error('Error adding phone number:', error);
      showMessage('Error connecting phone number. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRemovePhone = async () => {
    if (!userId || !phoneNumber) return;

    setLoading(true);
    try {
      const response = await fetch('/api/phone-management', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          phoneNumber,
          action: 'remove'
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setIsConnected(false);
        setPhoneNumber('');
        showMessage('Phone number disconnected successfully', 'success');
      } else {
        showMessage(data.message || 'Failed to disconnect phone number', 'error');
      }
    } catch (error) {
      console.error('Error removing phone number:', error);
      showMessage('Error disconnecting phone number. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!userId) {
    return (
      <div className="text-gray-500 text-center py-8">
        Please sign in to manage your phone number.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">📱 How SMS with Jarwik works:</h4>
        <div className="text-sm text-blue-800 space-y-2">
          <p><strong>1. Add your personal number below</strong> (the phone you&apos;ll text from)</p>
          <p><strong>2. Text Jarwik&apos;s number:</strong> <code className="bg-blue-100 px-2 py-1 rounded font-mono">+12672147419</code></p>
          <p><strong>3. Send commands like:</strong> &quot;Schedule meeting tomorrow at 2pm&quot;</p>
          <div className="bg-blue-100 p-2 rounded mt-2">
            <p className="font-semibold">✨ No Twilio account needed!</p>
            <p className="text-xs">Just text our central number from your personal phone.</p>
          </div>
        </div>
      </div>

      {/* Status */}
      <div className={`p-4 rounded-lg border ${
        isConnected ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
      }`}>
        <div className="flex items-center space-x-2">
          <span className={`text-2xl ${isConnected ? '📱' : '📵'}`}>
            {isConnected ? '📱' : '📵'}
          </span>
          <div>
            <p className={`font-medium ${isConnected ? 'text-green-800' : 'text-gray-700'}`}>
              {isConnected ? 'Phone Connected' : 'No Phone Connected'}
            </p>
            <p className={`text-sm ${isConnected ? 'text-green-600' : 'text-gray-500'}`}>
              {isConnected 
                ? 'You can now text Jarwik to schedule events and send emails!' 
                : 'Connect your phone to use SMS features'
              }
            </p>
          </div>
        </div>
      </div>

      {/* Phone Number Input */}
      <div className="space-y-3">
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
            Phone Number
          </label>
          <input
            type="tel"
            id="phone"
            value={phoneNumber}
            onChange={handlePhoneChange}
            placeholder="+91 9058566665"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={loading}
          />
          <p className="text-xs text-gray-500 mt-1">
            Enter with country code (e.g., +91 9058566665 for India, +1 555-0123 for US)
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-3">
          {!isConnected ? (
            <button
              onClick={handleAddPhone}
              disabled={loading || !phoneNumber}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Connecting...' : 'Connect Phone'}
            </button>
          ) : (
            <button
              onClick={handleRemovePhone}
              disabled={loading}
              className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Disconnecting...' : 'Disconnect Phone'}
            </button>
          )}
        </div>
      </div>

      {/* Message Display */}
      {message && (
        <div className={`p-3 rounded-md ${
          messageType === 'success' ? 'bg-green-100 text-green-800 border border-green-200' :
          messageType === 'error' ? 'bg-red-100 text-red-800 border border-red-200' :
          'bg-blue-100 text-blue-800 border border-blue-200'
        }`}>
          {message}
        </div>
      )}

      {/* Testing Instructions */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h4 className="font-medium text-green-900 mb-2">🧪 Ready to test!</h4>
        <div className="text-sm text-green-800 space-y-2">
          <p><strong>For Testing:</strong></p>
          <ol className="list-decimal list-inside space-y-1 ml-2 text-xs">
            <li>Add your personal number above</li>
            <li>From your phone, text: <code className="bg-green-100 px-1 rounded font-mono">+12672147419</code></li>
            <li>Send: &quot;Schedule meeting tomorrow at 2pm&quot;</li>
            <li>Check for response SMS and calendar event!</li>
          </ol>
          <div className="bg-green-100 p-2 rounded mt-2">
            <p className="font-semibold">🎯 Central Number Benefits:</p>
            <p className="text-xs">• No ngrok needed • No webhook setup • Works immediately</p>
          </div>
        </div>
      </div>

      {/* Usage Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">How to use SMS with Jarwik:</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• <strong>Schedule events:</strong> &quot;Schedule meeting tomorrow at 2pm&quot;</li>
          <li>• <strong>Send emails:</strong> &quot;Send email to john@example.com about project update&quot;</li>
          <li>• <strong>Check availability:</strong> &quot;Am I free on Friday?&quot;</li>
          <li>• <strong>View schedule:</strong> &quot;What&apos;s my schedule today?&quot;</li>
        </ul>
      </div>

      {/* Developer Information */}
      <details className="bg-gray-50 border border-gray-200 rounded-lg">
        <summary className="p-3 cursor-pointer text-sm font-medium text-gray-700">
          Developer Information
        </summary>
        <div className="p-3 pt-0 text-xs text-gray-600 space-y-2">
          <div>
            <p><strong>Central Jarwik Number:</strong></p>
            <code className="bg-gray-100 px-2 py-1 rounded text-xs">+12672147419</code>
          </div>
          <div>
            <p><strong>SMS Webhook URL:</strong></p>
            <code className="bg-gray-100 px-2 py-1 rounded text-xs">
              {typeof window !== 'undefined' ? window.location.origin : ''}/api/sms-webhook
            </code>
          </div>
          <div>
            <p><strong>Architecture:</strong></p>
            <p className="text-gray-500 text-xs">
              User Personal Number → Central Jarwik Number (+12672147419) → Webhook → Action Execution
            </p>
          </div>
          <div className="bg-gray-100 p-2 rounded">
            <p className="font-semibold text-xs">✅ Central Number Approach Active</p>
            <p className="text-xs text-gray-600">Users text one central number. No individual Twilio setup required.</p>
          </div>
        </div>
      </details>
    </div>
  );
}
