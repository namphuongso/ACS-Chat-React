import { useState, useRef, useMemo, useCallback, useEffect } from 'react';

interface UseVirtualScrollOptions {
  itemCount: number;
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
  scrollThrottleMs?: number;
}

interface VirtualItem {
  index: number;
  start: number;
  size: number;
}

export const useVirtualScroll = ({
  itemCount,
  itemHeight,
  containerHeight,
  overscan = 3,
  scrollThrottleMs = 16,
}: UseVirtualScrollOptions) => {
  const [scrollTop, setScrollTop] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollElementRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number>(0);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const lastScrollTimeRef = useRef<number>(0);

  const virtualItems = useMemo(() => {
    if (itemCount === 0) {
      return [];
    }

    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      itemCount - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );

    const items: VirtualItem[] = [];
    for (let i = startIndex; i <= endIndex; i++) {
      items.push({
        index: i,
        start: i * itemHeight,
        size: itemHeight,
      });
    }

    return items;
  }, [scrollTop, itemCount, itemHeight, containerHeight, overscan]);

  const totalHeight = useMemo(() => itemCount * itemHeight, [itemCount, itemHeight]);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const now = Date.now();
      const newScrollTop = e.currentTarget.scrollTop;

      if (!isScrolling) {
        setIsScrolling(true);
      }

      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      scrollTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false);
      }, 150);

      if (now - lastScrollTimeRef.current < scrollThrottleMs) {
        return;
      }

      lastScrollTimeRef.current = now;

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      animationFrameRef.current = requestAnimationFrame(() => {
        setScrollTop(newScrollTop);
      });
    },
    [isScrolling, scrollThrottleMs]
  );

  const scrollToIndex = useCallback(
    (index: number, behavior: ScrollBehavior = 'auto') => {
      if (scrollElementRef.current && index >= 0 && index < itemCount) {
        scrollElementRef.current.scrollTo({
          top: index * itemHeight,
          behavior,
        });
      }
    },
    [itemHeight, itemCount]
  );

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = 'auto') => {
      if (itemCount > 0) {
        scrollToIndex(itemCount - 1, behavior);
      }
    },
    [itemCount, scrollToIndex]
  );

  const scrollToTop = useCallback((behavior: ScrollBehavior = 'auto') => {
    if (scrollElementRef.current) {
      scrollElementRef.current.scrollTo({
        top: 0,
        behavior,
      });
    }
  }, []);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  return {
    virtualItems,
    totalHeight,
    scrollElementRef,
    handleScroll,
    scrollToIndex,
    scrollToBottom,
    scrollToTop,
    isScrolling,
    scrollTop,
  };
};
