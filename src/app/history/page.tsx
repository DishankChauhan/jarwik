'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import ProtectedRoute from '@/components/ProtectedRoute';

interface ConversationHistory {
  id: string;
  userId: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  source: 'text' | 'voice';
}

export default function HistoryPage() {
  return (
    <ProtectedRoute>
      <HistoryContent />
    </ProtectedRoute>
  );
}

function HistoryContent() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationHistory[]>([]);
  const [loading, setLoading] = useState(true);

  // Mock data for now - replace with real Firestore queries later
  useEffect(() => {
    // Simulate loading
    setTimeout(() => {
      setConversations([
        {
          id: '1',
          userId: user?.uid || '',
          type: 'user',
          content: 'Schedule a meeting with John tomorrow at 2 PM',
          timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
          source: 'voice'
        },
        {
          id: '2',
          userId: user?.uid || '',
          type: 'assistant',
          content: 'I\'ve scheduled a meeting with John for tomorrow at 2 PM. I\'ve sent calendar invites to both of you.',
          timestamp: new Date(Date.now() - 1000 * 60 * 29), // 29 minutes ago
          source: 'voice'
        },
        {
          id: '3',
          userId: user?.uid || '',
          type: 'user',
          content: 'What\'s the weather like today?',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
          source: 'text'
        },
        {
          id: '4',
          userId: user?.uid || '',
          type: 'assistant',
          content: 'Today\'s weather is partly cloudy with a high of 72°F and a low of 58°F. There\'s a 20% chance of rain.',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2 + 30), // 2 hours ago
          source: 'text'
        }
      ]);
      setLoading(false);
    }, 1000);
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading conversation history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Conversation History</h1>
          <p className="text-gray-600 mt-2">
            View your past interactions with Jarwik
          </p>
        </div>

        {/* Filter Options */}
        <div className="mb-6 flex flex-wrap gap-4">
          <div className="flex items-center space-x-2">
            <button className="px-4 py-2 bg-orange-100 text-orange-700 rounded-lg text-sm font-medium">
              All
            </button>
            <button className="px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg text-sm font-medium">
              Voice Only
            </button>
            <button className="px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg text-sm font-medium">
              Text Only
            </button>
          </div>
          <select className="px-4 py-2 border border-gray-300 rounded-lg text-sm">
            <option>Last 7 days</option>
            <option>Last 30 days</option>
            <option>Last 90 days</option>
            <option>All time</option>
          </select>
        </div>

        {/* Conversation History */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          {conversations.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No conversations yet</h3>
              <p className="text-gray-500">Start a conversation with Jarwik to see your history here.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {conversations.map((conversation) => (
                <div key={conversation.id} className="p-6">
                  <div className="flex items-start space-x-4">
                    {/* Avatar */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      conversation.type === 'user' 
                        ? 'bg-blue-100 text-blue-600' 
                        : 'bg-orange-100 text-orange-600'
                    }`}>
                      {conversation.type === 'user' ? (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                        </svg>
                      )}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-gray-900">
                          {conversation.type === 'user' ? 'You' : 'Jarwik'}
                        </p>
                        <div className="flex items-center space-x-2 text-xs text-gray-500">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            conversation.source === 'voice'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {conversation.source === 'voice' ? (
                              <>
                                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
                                  <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4M8 22h8"/>
                                </svg>
                                Voice
                              </>
                            ) : (
                              <>
                                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M3 5a2 2 0 0 1 2-2h3.28a1 1 0 0 1 .948.684l1.498 4.493a1 1 0 0 1-.502 1.21l-2.257 1.13a11.042 11.042 0 0 0 5.516 5.516l1.13-2.257a1 1 0 0 1 1.21-.502l4.493 1.498a1 1 0 0 1 .684.949V19a2 2 0 0 1-2 2h-1C9.716 21 3 14.284 3 6V5Z"/>
                                </svg>
                                Text
                              </>
                            )}
                          </span>
                          <span>{conversation.timestamp.toLocaleString()}</span>
                        </div>
                      </div>
                      <p className="text-gray-700">{conversation.content}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Load More Button */}
        {conversations.length > 0 && (
          <div className="mt-6 text-center">
            <button className="px-6 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
              Load More Conversations
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
