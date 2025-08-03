// Utility function to parse natural language time into proper Date objects
// All times are interpreted as Indian Standard Time (IST) unless specified otherwise
export function parseNaturalTime(timeStr: string): Date | null {
  if (!timeStr) return null;

  // Current time in IST
  const now = new Date();
  // IST is UTC+5:30, so to get IST time we add the offset
  const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30 
  const nowIST = new Date(now.getTime() + istOffset);
  
  const normalizedTime = timeStr.toLowerCase().trim();

  // Handle relative time patterns (these are already relative to current time)
  if (normalizedTime.includes('minute')) {
    const minutes = extractNumber(normalizedTime);
    if (minutes) {
      return new Date(now.getTime() + minutes * 60 * 1000);
    }
  }

  if (normalizedTime.includes('hour')) {
    const hours = extractNumber(normalizedTime);
    if (hours) {
      return new Date(now.getTime() + hours * 60 * 60 * 1000);
    }
  }

  if (normalizedTime.includes('day')) {
    const days = extractNumber(normalizedTime);
    if (days) {
      return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    }
  }

  // Handle "tomorrow" in IST
  if (normalizedTime.includes('tomorrow')) {
    // Work in UTC but account for IST interpretation
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    
    // Try to extract specific time
    const timeMatch = normalizedTime.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2] || '0');
      const ampm = timeMatch[3]?.toLowerCase();
      
      if (ampm === 'pm' && hours !== 12) hours += 12;
      if (ampm === 'am' && hours === 12) hours = 0;
      
      // Set the time in UTC but account for IST
      // If user says "3 PM IST", we need to store it as 9:30 AM UTC
      tomorrow.setUTCHours(hours - 5, minutes - 30, 0, 0);
    } else {
      // Default to 9 AM IST = 3:30 AM UTC
      tomorrow.setUTCHours(3, 30, 0, 0);
    }
    
    return tomorrow;
  }

  // Handle "next week" in IST
  if (normalizedTime.includes('next week')) {
    const nextWeek = new Date(now);
    nextWeek.setUTCDate(nextWeek.getUTCDate() + 7);
    // Default to 9 AM IST = 3:30 AM UTC
    nextWeek.setUTCHours(3, 30, 0, 0);
    return nextWeek;
  }

  // Handle specific times today (e.g., "3 PM", "2:30 PM", "10:30") - interpreted as IST
  const timeMatch = normalizedTime.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1]);
    const minutes = parseInt(timeMatch[2] || '0');
    const ampm = timeMatch[3]?.toLowerCase();
    
    // If no AM/PM specified and hours < 12, assume it could be either
    // For ambiguous times like "10:30", prefer PM if it's after current time
    if (!ampm && hours < 12) {
      const currentHour = nowIST.getHours();
      const currentMinute = nowIST.getMinutes();
      const currentTotalMinutes = currentHour * 60 + currentMinute;
      const specifiedTotalMinutes = hours * 60 + minutes;
      
      // If the specified time has already passed today in AM, assume PM
      if (specifiedTotalMinutes <= currentTotalMinutes) {
        hours += 12;
      }
    } else {
      if (ampm === 'pm' && hours !== 12) hours += 12;
      if (ampm === 'am' && hours === 12) hours = 0;
    }
    
    const result = new Date(now);
    // Convert IST time to UTC for storage
    result.setUTCHours(hours - 5, minutes - 30, 0, 0);
    
    // If the time has passed today, schedule for tomorrow
    if (result <= now) {
      result.setUTCDate(result.getUTCDate() + 1);
    }
    
    return result;
  }

  // Try to parse as ISO date or standard date formats
  try {
    const parsed = new Date(timeStr);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  } catch {
    console.warn('Failed to parse time string:', timeStr);
  }

  return null;
}

function extractNumber(text: string): number | null {
  // Look for patterns like "20 minutes", "in 5 hours", "2 days"
  const match = text.match(/(?:in\s+)?(\d+)\s*(?:minute|hour|day)/i);
  return match ? parseInt(match[1]) : null;
}

// Format date for user display in Indian Standard Time
export function formatDateForUser(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMinutes = Math.round(diffMs / (1000 * 60));
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 60) {
    return `in ${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''}`;
  } else if (diffHours < 24) {
    return `in ${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
  } else if (diffDays < 7) {
    return `in ${diffDays} day${diffDays !== 1 ? 's' : ''}`;
  } else {
    // Convert to IST for display
    const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
    const istDate = new Date(date.getTime() + istOffset);
    
    return istDate.toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'Asia/Kolkata'
    }) + ' IST';
  }
}
