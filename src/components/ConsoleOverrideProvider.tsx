'use client';

import { useEffect } from 'react';
import { initializeConsoleOverride } from '@/utils/consoleOverride';

interface ConsoleOverrideProviderProps {
  children: React.ReactNode;
}

export default function ConsoleOverrideProvider({ children }: ConsoleOverrideProviderProps) {
  useEffect(() => {
    // Initialize console override on mount
    initializeConsoleOverride();
    
    // No cleanup needed as we want this to persist for the entire app lifecycle
  }, []);

  return <>{children}</>;
}
