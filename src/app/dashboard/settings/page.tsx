'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';

export default function SettingsPage() {
  const { userProfile, updateUserProfile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState(userProfile?.phone || '');

  const handleUpdatePreferences = async (key: keyof NonNullable<typeof userProfile>['preferences'], value: boolean | string | number) => {
    if (!userProfile) return;

    try {
      setIsLoading(true);
      await updateUserProfile({
        preferences: {
          ...userProfile.preferences,
          [key]: value,
        },
      });
    } catch (error) {
      console.error('Error updating preferences:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdatePhone = async () => {
    if (!userProfile) return;

    try {
      setIsLoading(true);
      await updateUserProfile({ phone: phoneNumber });
      alert('Phone number updated successfully!');
    } catch (error) {
      console.error('Error updating phone:', error);
      alert('Failed to update phone number. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!userProfile) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading settings...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto py-6 px-6">
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
            <p className="text-gray-600">Manage your account preferences and integrations</p>
          </div>

          <div className="p-6 space-y-8">
            {/* Profile Information */}
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-4">Profile Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={userProfile.displayName}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Name is managed by your OAuth provider
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={userProfile.email}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Email is managed by your OAuth provider
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+1 (555) 123-4567"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <button
                      onClick={handleUpdatePhone}
                      disabled={isLoading || phoneNumber === userProfile.phone}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Update
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Used for SMS and voice call features
                  </p>
                </div>
              </div>
            </div>

            {/* Voice Preferences */}
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-4">Voice Preferences</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">Voice Agent Enabled</h3>
                    <p className="text-sm text-gray-500">
                      Allow voice interactions with your AI assistant
                    </p>
                  </div>
                  <button
                    onClick={() => handleUpdatePreferences('voiceEnabled', !userProfile.preferences.voiceEnabled)}
                    disabled={isLoading}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                      userProfile.preferences.voiceEnabled ? 'bg-indigo-600' : 'bg-gray-200'
                    } disabled:opacity-50`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        userProfile.preferences.voiceEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Notification Preferences */}
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-4">Notifications</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">Push Notifications</h3>
                    <p className="text-sm text-gray-500">
                      Receive notifications for reminders, tasks, and updates
                    </p>
                  </div>
                  <button
                    onClick={() => handleUpdatePreferences('notifications', !userProfile.preferences.notifications)}
                    disabled={isLoading}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                      userProfile.preferences.notifications ? 'bg-indigo-600' : 'bg-gray-200'
                    } disabled:opacity-50`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        userProfile.preferences.notifications ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Theme Preferences */}
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-4">Appearance</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Theme
                </label>
                <select
                  value={userProfile.preferences.theme}
                  onChange={(e) => handleUpdatePreferences('theme', e.target.value)}
                  disabled={isLoading}
                  className="w-full md:w-auto px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50"
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="system">System</option>
                </select>
              </div>
            </div>

            {/* Integrations (placeholder for future features) */}
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-4">Integrations</h2>
              <div className="bg-gray-50 rounded-lg p-6 text-center">
                <div className="text-4xl mb-2">🔗</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Connect Your Apps
                </h3>
                <p className="text-gray-600 mb-4">
                  Integration with Google Calendar, Gmail, Slack, and more coming soon!
                </p>
                <button
                  disabled
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-gray-400 cursor-not-allowed"
                >
                  Coming Soon
                </button>
              </div>
            </div>

            {/* Account Info */}
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-4">Account Information</h2>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">Account created:</span>
                    <span className="ml-2 text-gray-600">
                      {userProfile.createdAt.toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Last login:</span>
                    <span className="ml-2 text-gray-600">
                      {userProfile.lastLoginAt.toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
