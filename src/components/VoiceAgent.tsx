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
      {/* Container for the voice agent */}
      <div 
        className="relative flex items-center justify-center cursor-pointer transition-all duration-500 ease-out"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleActivateAgent}
        style={{ width: '300px', height: '200px' }}
      >
        {/* Left circle - appears on hover */}
        <div className={`absolute transition-all duration-700 ease-out ${
          isHovered ? 'opacity-100 scale-100 translate-x-0' : 'opacity-0 scale-75 translate-x-8'
        }`}
        style={{ left: '20px' }}>
          <div className="w-24 h-24 bg-gradient-to-br from-amber-200 to-orange-300 rounded-full opacity-80"></div>
        </div>

        {/* Right circle - appears on hover */}
        <div className={`absolute transition-all duration-700 ease-out ${
          isHovered ? 'opacity-100 scale-100 translate-x-0' : 'opacity-0 scale-75 -translate-x-8'
        }`}
        style={{ right: '20px' }}>
          <div className="w-24 h-24 bg-gradient-to-br from-orange-300 to-amber-200 rounded-full opacity-80"></div>
        </div>

        {/* Main center circle - always visible */}
        <div className={`relative w-32 h-32 bg-gradient-to-br from-orange-400 to-orange-500 rounded-full flex items-center justify-center transition-all duration-500 ease-out shadow-lg z-10 ${
          isHovered ? 'scale-110 shadow-xl' : 'scale-100'
        } ${
          isActive ? 'bg-gradient-to-br from-green-400 to-green-500' : ''
        } ${
          isSpeaking ? 'animate-pulse' : ''
        }`}>
          
          {/* Microphone icon */}
          <div className="w-6 h-6 flex items-center justify-center text-white">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              fill="none" 
              viewBox="0 0 24 24" 
              strokeWidth={2.5} 
              stroke="currentColor" 
              className="w-5 h-5"
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

          {/* Active indicator ring */}
          {isActive && (
            <div className="absolute inset-0 rounded-full border-2 border-green-300 animate-ping opacity-50"></div>
          )}
        </div>
      </div>
    </div>
  );
}
