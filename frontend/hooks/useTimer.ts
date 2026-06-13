'use client';
import { useState, useEffect, useRef } from 'react';

export function useTimer(durationMinutes: number, onExpire: () => void) {
  const [remaining, setRemaining] = useState(durationMinutes * 60);
  const ref = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    ref.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(ref.current!);
          onExpire();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(ref.current!);
  }, []);

  const minutes = Math.floor(remaining / 60).toString().padStart(2, '0');
  const seconds = (remaining % 60).toString().padStart(2, '0');
  const isUrgent = remaining < 300; // 5 daqiqa

  return { remaining, display: `${minutes}:${seconds}`, isUrgent };
}
