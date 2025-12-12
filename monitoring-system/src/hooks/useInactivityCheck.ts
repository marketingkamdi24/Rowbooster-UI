import { useEffect, useRef, useCallback } from 'react';
import { dispatchSessionExpired } from '@/lib/api';

interface UseInactivityCheckOptions {
  // Time in milliseconds before checking session on inactivity
  inactivityTimeout?: number;
  // Interval to check session validity during inactivity
  checkInterval?: number;
  // Whether the check is enabled
  enabled?: boolean;
}

/**
 * Hook to track user inactivity and check session validity.
 * When the user is inactive for the specified timeout, it will periodically
 * check session validity and redirect to login if the session has expired.
 * 
 * The server session expires after 1 hour of inactivity.
 * This hook checks the session after 55 minutes of client inactivity
 * to catch expiration before the full hour.
 */
export function useInactivityCheck({
  inactivityTimeout = 55 * 60 * 1000, // 55 minutes (5 min before server timeout)
  checkInterval = 60 * 1000, // Check every minute during inactivity
  enabled = true,
}: UseInactivityCheckOptions = {}) {
  const lastActivityRef = useRef<number>(Date.now());
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isCheckingRef = useRef<boolean>(false);

  // Check if session is still valid
  const checkSession = useCallback(async () => {
    if (isCheckingRef.current) return;
    isCheckingRef.current = true;

    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
      });

      if (response.status === 401) {
        console.log('[INACTIVITY] Session expired, redirecting to login');
        dispatchSessionExpired();
        // Clear intervals on session expiration
        if (checkIntervalRef.current) {
          clearInterval(checkIntervalRef.current);
          checkIntervalRef.current = null;
        }
      }
    } catch (error) {
      console.error('[INACTIVITY] Error checking session:', error);
    } finally {
      isCheckingRef.current = false;
    }
  }, []);

  // Reset activity timer
  const resetActivityTimer = useCallback(() => {
    lastActivityRef.current = Date.now();

    // Clear existing timers
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
      checkIntervalRef.current = null;
    }

    // Set new inactivity timer
    inactivityTimerRef.current = setTimeout(() => {
      console.log('[INACTIVITY] User inactive, starting session checks');
      // Start periodic session checks
      checkSession();
      checkIntervalRef.current = setInterval(checkSession, checkInterval);
    }, inactivityTimeout);
  }, [inactivityTimeout, checkInterval, checkSession]);

  // Activity event handler
  const handleActivity = useCallback(() => {
    resetActivityTimer();
  }, [resetActivityTimer]);

  useEffect(() => {
    if (!enabled) return;

    // Activity events to track
    const events = [
      'mousedown',
      'mousemove',
      'keydown',
      'touchstart',
      'scroll',
      'click',
    ];

    // Add event listeners
    events.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Start initial timer
    resetActivityTimer();

    // Cleanup
    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });

      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [enabled, handleActivity, resetActivityTimer]);

  // Return a function to manually check session
  return { checkSession };
}

export default useInactivityCheck;