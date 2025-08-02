'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';

interface VoiceSession {
  id: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  messages: Array<{
    type: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
}

export default function VoiceHistoryPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<VoiceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<VoiceSession | null>(null);

  useEffect(() => {
    if (!user) return;

    // For now, we'll simulate voice sessions since we haven't implemented session tracking yet
    // In the next phase, we'll properly track voice conversations
    const simulatedSessions: VoiceSession[] = [
      {
        id: '1',
        userId: user.uid,
        startTime: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        endTime: new Date(Date.now() - 2 * 60 * 60 * 1000 + 3 * 60 * 1000), // 3 minutes duration
        duration: 180, // 3 minutes in seconds
        messages: [
          {
            type: 'user',
            content: 'What meetings do I have today?',
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
          },
          {
            type: 'assistant',
            content: 'You have 3 meetings today: Team standup at 9 AM, Client call at 2 PM, and Project review at 4 PM.',
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000 + 30 * 1000),
          },
          {
            type: 'user',
            content: 'Reschedule the client call to tomorrow at the same time.',
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000 + 60 * 1000),
          },
          {
            type: 'assistant',
            content: 'I\'ve rescheduled your client call from today at 2 PM to tomorrow at 2 PM. The client has been notified.',
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000 + 90 * 1000),
          },
        ],
      },
      {
        id: '2',
        userId: user.uid,
        startTime: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
        endTime: new Date(Date.now() - 24 * 60 * 60 * 1000 + 2 * 60 * 1000), // 2 minutes duration
        duration: 120,
        messages: [
          {
            type: 'user',
            content: 'Send an email to the team about the project update.',
            timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
          {
            type: 'assistant',
            content: 'I\'ve sent an email to your team with the project update. The email includes the latest milestones and next steps.',
            timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000 + 45 * 1000),
          },
        ],
      },
    ];

    setSessions(simulatedSessions);
    setLoading(false);
  }, [user]);

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (date: Date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading voice history...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto py-6 px-6">
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">Voice History</h1>
            <p className="text-gray-600">Review your past voice conversations</p>
          </div>

          {sessions.length === 0 ? (
            <div className="p-6 text-center">
              <div className="text-6xl mb-4">🎙️</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No voice conversations yet
              </h3>
              <p className="text-gray-600">
                Start a voice conversation from the dashboard to see your history here.
              </p>
            </div>
          ) : (
            <div className="flex">
              {/* Sessions List */}
              <div className="w-1/3 border-r border-gray-200">
                <div className="p-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-4">
                    Recent Sessions ({sessions.length})
                  </h3>
                  <div className="space-y-2">
                    {sessions.map((session) => (
                      <button
                        key={session.id}
                        onClick={() => setSelectedSession(session)}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          selectedSession?.id === session.id
                            ? 'border-indigo-500 bg-indigo-50'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-900">
                            {formatDate(session.startTime)}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatTime(session.startTime)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-600">
                            {session.messages.length} messages
                          </span>
                          {session.duration && (
                            <span className="text-xs text-gray-500">
                              {formatDuration(session.duration)}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Session Details */}
              <div className="flex-1">
                {selectedSession ? (
                  <div className="p-6">
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-medium text-gray-900">
                          {formatDate(selectedSession.startTime)} - {formatTime(selectedSession.startTime)}
                        </h3>
                        {selectedSession.duration && (
                          <span className="text-sm text-gray-500">
                            Duration: {formatDuration(selectedSession.duration)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        {selectedSession.messages.length} messages exchanged
                      </p>
                    </div>

                    <div className="space-y-4">
                      {selectedSession.messages.map((message, index) => (
                        <div
                          key={index}
                          className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-lg px-4 py-2 rounded-lg ${
                              message.type === 'user'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-gray-100 text-gray-900'
                            }`}
                          >
                            <p className="text-sm">{message.content}</p>
                            <div className="flex items-center justify-between mt-1">
                              <span className={`text-xs ${
                                message.type === 'user' ? 'text-indigo-200' : 'text-gray-500'
                              }`}>
                                {formatTime(message.timestamp)}
                              </span>
                              <span className={`text-xs ml-2 ${
                                message.type === 'user' ? 'text-indigo-200' : 'text-gray-500'
                              }`}>
                                🎙️
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-6 text-center">
                    <div className="text-4xl mb-4">💬</div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Select a conversation
                    </h3>
                    <p className="text-gray-600">
                      Choose a session from the left to view the conversation details.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Stats Card */}
        <div className="mt-6 bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Voice Statistics</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-indigo-600">
                {sessions.length}
              </div>
              <div className="text-sm text-gray-500">Total Sessions</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-indigo-600">
                {sessions.reduce((total, session) => total + session.messages.length, 0)}
              </div>
              <div className="text-sm text-gray-500">Total Messages</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-indigo-600">
                {sessions.reduce((total, session) => total + (session.duration || 0), 0) > 0
                  ? formatDuration(sessions.reduce((total, session) => total + (session.duration || 0), 0))
                  : '0:00'
                }
              </div>
              <div className="text-sm text-gray-500">Total Time</div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
