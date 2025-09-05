
import { useRef, useEffect, useCallback } from 'react';
import { useIsMobile } from './use-mobile';

export function useScrollOnFocus() {
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const handleFocus = useCallback((event: FocusEvent) => {
    const target = event.target as HTMLElement;
    // The timeout gives the keyboard time to appear before we scroll
    setTimeout(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  }, []);

  const registerForFocus = useCallback((name: string) => {
    // We can't actually use the `name` to get a ref from react-hook-form easily here.
    // Instead, we'll return an object that can be spread onto the Input component.
    // Since this hook is specific to our forms, we know the input will be a direct child.
    // We will attach the event listener to the container and listen for focus events bubbling up.
    // This is more efficient than attaching a listener to every input.
    return {};
  }, []);
  
  useEffect(() => {
    const container = containerRef.current;
    if (container && isMobile) {
      container.addEventListener('focusin', handleFocus);
      return () => {
        container.removeEventListener('focusin', handleFocus);
      };
    }
  }, [isMobile, handleFocus]);

  return { containerRef, registerForFocus };
}
