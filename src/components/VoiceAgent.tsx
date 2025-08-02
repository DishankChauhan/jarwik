'use client';

import { useConversation } from '@elevenlabs/react';
import { useState } from 'react';

interface VoiceAgentProps {
  className?: string;
}

export default function VoiceAgent({ className = '' }: VoiceAgentProps) {
  const [isHovered, setIsHovered] = useState(false);
  
  const conversation = useConversation({
    onConnect: () => {}, 
    onDisconnect: () => {}, 
    onError: () => {}, 
    onMessage: () => {}, 
    onDebug: () => {}, 
  });

  const handleActivateAgent = async () => {
    if (conversation.status === 'connected') {
      // End the conversation
      await conversation.endSession();
    } else {
      try {
        // Request microphone permission first
        await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // Start the conversation with your agent ID
        await conversation.startSession({
          agentId: 'agent_0601k1mmx39zen7tsbz3b9s367ez',
          connectionType: 'webrtc', // or 'websocket'
        });
        
        // Silently start conversation without logging
      } catch {
        // Only show user-friendly error message
        alert('Failed to start voice conversation. Please allow microphone access.');
      }
    }
  };

  const isActive = conversation.status === 'connected';
  const isSpeaking = conversation.isSpeaking;

  return (
    <div className={`relative ${className}`}>
      {/* Container for the animated circles */}
      <div 
        className="relative flex items-center justify-center cursor-pointer transition-all duration-500 ease-out"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleActivateAgent}
      >
        {/* Background circles that appear on hover */}
        <div className={`absolute transition-all duration-700 ease-out ${isHovered ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}>
          {/* Left circle */}
          <div className="absolute w-32 h-32 bg-gradient-to-br from-yellow-300 to-orange-400 rounded-full -translate-x-16 opacity-60 blur-sm"></div>
          {/* Right circle */}
          <div className="absolute w-32 h-32 bg-gradient-to-bl from-orange-300 to-amber-400 rounded-full translate-x-16 opacity-60 blur-sm"></div>
        </div>

        {/* Main center circle */}
        <div className={`relative w-40 h-40 bg-gradient-to-br from-yellow-200 via-orange-200 to-amber-300 rounded-full flex items-center justify-center transition-all duration-500 ease-out shadow-2xl ${
          isHovered ? 'scale-110 shadow-orange-200/50' : 'scale-100'
        } ${
          isActive ? 'animate-pulse bg-gradient-to-br from-green-200 via-emerald-200 to-teal-300' : ''
        } ${
          isSpeaking ? 'ring-4 ring-teal-400 ring-opacity-60' : ''
        }`}>
          
          {/* Microphone icon */}
          <div className={`w-8 h-8 flex items-center justify-center transition-all duration-300 ${
            isActive ? 'text-teal-700' : 'text-orange-700'
          }`}>
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              fill="none" 
              viewBox="0 0 24 24" 
              strokeWidth={2} 
              stroke="currentColor" 
              className="w-6 h-6"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" 
              />
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4M8 22h8" 
              />
            </svg>
          </div>

          {/* Ripple effect when active */}
          {isActive && (
            <div className="absolute inset-0 rounded-full border-2 border-teal-300 animate-ping opacity-30"></div>
          )}
        </div>

        {/* Voice activity indicator */}
        {isActive && (
          <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2">
            <div className="flex space-x-1">
              <div className={`w-1 h-4 bg-teal-500 rounded-full ${isSpeaking ? 'animate-pulse' : 'opacity-50'}`}></div>
              <div className={`w-1 h-6 bg-teal-500 rounded-full ${isSpeaking ? 'animate-pulse' : 'opacity-50'}`} style={{ animationDelay: '0.1s' }}></div>
              <div className={`w-1 h-5 bg-teal-500 rounded-full ${isSpeaking ? 'animate-pulse' : 'opacity-50'}`} style={{ animationDelay: '0.2s' }}></div>
              <div className={`w-1 h-4 bg-teal-500 rounded-full ${isSpeaking ? 'animate-pulse' : 'opacity-50'}`} style={{ animationDelay: '0.3s' }}></div>
            </div>
          </div>
        )}
      </div>

      {/* Status text */}
      <div className="text-center mt-8">
        <p className={`text-sm transition-colors duration-300 ${
          isActive ? 'text-teal-600' : 'text-gray-500'
        }`}>
          {conversation.status === 'connecting' ? 'Connecting to voice agent...' :
           isActive ? (isSpeaking ? 'Agent is speaking...' : 'Listening - speak now!') : 
           'Click to start voice conversation'}
        </p>
      </div>
    </div>
  );
}
