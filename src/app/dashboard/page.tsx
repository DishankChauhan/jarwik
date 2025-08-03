'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { collection, addDoc, query, orderBy, limit, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import DashboardLayout from '@/components/DashboardLayout';
import VoiceAgent from '@/components/VoiceAgent';
import ProtectedRoute from '@/components/ProtectedRoute';

interface Message {
  id: string;
  userId: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  source: 'text' | 'voice';
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}

function DashboardContent() {
  const { user, userProfile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load conversation history
  useEffect(() => {
    if (!user || !db) return;

    const messagesQuery = query(
      collection(db, 'conversations'),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const messagesData: Message[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.userId === user.uid) {
          messagesData.push({
            id: doc.id,
            ...data,
            timestamp: data.timestamp?.toDate() || new Date(),
          } as Message);
        }
      });
      
      // Reverse to show oldest first
      setMessages(messagesData.reverse());
    });

    return () => unsubscribe();
  }, [user]); // Removed 'db' dependency as it's not needed

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (content: string, source: 'text' | 'voice' = 'text') => {
    if (!user || !content.trim() || !db) return;

    try {
      setIsLoading(true);

      // Add user message
      const userMessage = {
        userId: user.uid,
        type: 'user' as const,
        content: content.trim(),
        timestamp: Timestamp.now(),
        source,
      };

      await addDoc(collection(db, 'conversations'), userMessage);

      // Clear input if it was a text message
      if (source === 'text') {
        setInputValue('');
      }

      // Call the dedicated chat API
      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: content,
            userId: user.uid,
            conversationHistory: messages.slice(-5).map(msg => ({
              role: msg.type === 'user' ? 'user' : 'assistant',
              content: msg.content,
              timestamp: msg.timestamp.toISOString()
            }))
          }),
        });

        const aiResponse = await response.json();
        
        const assistantMessage = {
          userId: user.uid,
          type: 'assistant' as const,
          content: aiResponse.message || 'I apologize, but I encountered an error processing your request.',
          timestamp: Timestamp.now(),
          source: 'text' as const,
        };

        await addDoc(collection(db, 'conversations'), assistantMessage);
      } catch (error) {
        console.error('Error calling chat API:', error);
        
        // Fallback message
        const errorMessage = {
          userId: user.uid,
          type: 'assistant' as const,
          content: 'I apologize, but I encountered an error processing your request. Please try again or check your account permissions in Settings.',
          timestamp: Timestamp.now(),
          source: 'text' as const,
        };

        await addDoc(collection(db, 'conversations'), errorMessage);
      }
      
      setIsLoading(false);

    } catch (error) {
      console.error('Error sending message:', error);
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputValue);
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col h-screen">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Welcome back, {userProfile?.displayName?.split(' ')[0]}!
              </h1>
              <p className="text-gray-600">
                How can I assist you today?
              </p>
            </div>
            
            {/* Voice Agent */}
            <div className="flex-shrink-0">
              <VoiceAgent className="scale-75" />
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🤖</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Start a conversation
              </h3>
              <p className="text-gray-600 max-w-md mx-auto">
                You can type a message below or click the voice agent to start talking. 
                Try asking me to help with your calendar, send emails, or manage tasks!
              </p>
              
              {/* Quick actions */}
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {[
                  "What's on my calendar today?",
                  "Send an email to my team",
                  "Add a task to my to-do list",
                  "What's the weather like?",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => sendMessage(suggestion)}
                    className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-sm text-gray-700 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
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
                      {message.timestamp.toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </span>
                    {message.source === 'voice' && (
                      <span className={`text-xs ml-2 ${
                        message.type === 'user' ? 'text-indigo-200' : 'text-gray-500'
                      }`}>
                        🎙️
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 text-gray-900 max-w-xs lg:max-w-md px-4 py-2 rounded-lg">
                <div className="flex items-center space-x-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                  <span className="text-sm text-gray-500">Thinking...</span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="bg-white border-t border-gray-200 px-6 py-4">
          <form onSubmit={handleSubmit} className="flex space-x-3">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Type your message..."
              disabled={isLoading}
              className="flex-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isLoading || !inputValue.trim()}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}
