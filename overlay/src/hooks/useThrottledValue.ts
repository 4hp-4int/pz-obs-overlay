import { useState, useEffect, useRef } from 'react';

export function useThrottledValue<T>(value: T, interval: number = 100): T {
    const [throttledValue, setThrottledValue] = useState<T>(value);
    const lastUpdate = useRef<number>(0);

    useEffect(() => {
        const now = Date.now();
        if (now - lastUpdate.current >= interval) {
            setThrottledValue(value);
            lastUpdate.current = now;
        }
    }, [value, interval]);

    return throttledValue;
} 