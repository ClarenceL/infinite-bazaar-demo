import { useState, useEffect } from 'react';

/**
 * Get the instance ID from URL parameters or return default
 */
export function getInstanceIdFromUrl(): string {
  if (typeof window === 'undefined') {
    return 'default';
  }
  
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('instance') || 'default';
}

/**
 * Hook to get current instance ID and listen for changes
 */
export function useInstanceId(): string {
  const [instanceId, setInstanceId] = useState<string>('default');

  useEffect(() => {
    // Set initial value
    setInstanceId(getInstanceIdFromUrl());
    
    // Listen for URL changes (back/forward buttons, programmatic navigation)
    const handleUrlChange = () => {
      setInstanceId(getInstanceIdFromUrl());
    };
    
    // Listen for popstate events (back/forward buttons)
    window.addEventListener('popstate', handleUrlChange);
    
    // Listen for pushstate/replacestate (programmatic navigation)
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;
    
    window.history.pushState = function (...args) {
      originalPushState.apply(window.history, args);
      handleUrlChange();
    };
    
    window.history.replaceState = function (...args) {
      originalReplaceState.apply(window.history, args);
      handleUrlChange();
    };
    
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    };
  }, []);
  
  return instanceId;
} 