/**
 * Console override utility to suppress unwanted logs from third-party libraries
 */

// Store original console methods
const originalMethods = {
  log: console.log,
  warn: console.warn,
  info: console.info,
  error: console.error,
  debug: console.debug,
};

// Patterns to filter out
const suppressPatterns = [
  // LiveKit patterns
  'livekit',
  'LiveKit',
  'WebRTC',
  'publishing track',
  'disconnect from room',
  'detected connection state mismatch',
  'room_agent_',
  'rtc_room_agent_',
  'mic track',
  'audio track',
  'participant',
  'Connection state changed',
  'signaling state',
  'ice connection state',
  'peer connection state',
  'track published',
  'track unpublished',
  'track enabled',
  'track disabled',
  'media stream',
  'user media',
  'microphone',
  
  // ElevenLabs patterns
  'elevenlabs',
  'ElevenLabs',
  'voice agent',
  'conversation',
  'websocket',
  'audio context',
  'audio worklet',
  'pcm',
  'audio buffer',
  'sample rate',
  
  // Other WebRTC/Audio patterns
  'getUserMedia',
  'mediaDevices',
  'audio constraint',
  'audio track',
  'rtp',
  'rtcp',
  'sdp',
  'ice candidate',
  'dtls',
  'srtp',
];

function shouldSuppress(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  return suppressPatterns.some(pattern => 
    lowerMessage.includes(pattern.toLowerCase())
  );
}

function filterArgs(args: unknown[]): boolean {
  const message = args.join(' ');
  return shouldSuppress(message);
}

export function initializeConsoleOverride() {
  // Only suppress logs in production or when specifically needed
  if (process.env.NODE_ENV === 'production') {
    // In production, completely suppress all logs from third-party libraries
    console.log = () => {};
    console.warn = () => {};
    console.info = () => {};
    console.debug = () => {};
    
    // Keep only critical errors
    console.error = (...args: unknown[]) => {
      if (!filterArgs(args)) {
        originalMethods.error(...args);
      }
    };
  } else {
    // In development, filter selectively
    console.log = (...args: unknown[]) => {
      if (!filterArgs(args)) {
        originalMethods.log(...args);
      }
    };

    console.warn = (...args: unknown[]) => {
      if (!filterArgs(args)) {
        originalMethods.warn(...args);
      }
    };

    console.info = (...args: unknown[]) => {
      if (!filterArgs(args)) {
        originalMethods.info(...args);
      }
    };

    console.debug = (...args: unknown[]) => {
      if (!filterArgs(args)) {
        originalMethods.debug(...args);
      }
    };

    console.error = (...args: unknown[]) => {
      if (!filterArgs(args)) {
        originalMethods.error(...args);
      }
    };
  }
}

export function restoreConsole() {
  console.log = originalMethods.log;
  console.warn = originalMethods.warn;
  console.info = originalMethods.info;
  console.error = originalMethods.error;
  console.debug = originalMethods.debug;
}
