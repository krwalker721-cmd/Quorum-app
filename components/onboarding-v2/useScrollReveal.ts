import { useEffect, useRef, useState, type RefObject } from "react";

// Fire-once intersection observer. Returns a ref to attach to the element and a
// boolean that flips to true the first time the element is at least `threshold`
// visible — then stops observing so the animation never replays on scroll-up.
export function useScrollReveal<T extends HTMLElement = HTMLDivElement>(
  threshold = 0.2,
): { ref: RefObject<T>; isVisible: boolean } {
  const ref = useRef<T>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Already on screen at mount (e.g. returning user scrolled here): reveal now.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, isVisible };
}
