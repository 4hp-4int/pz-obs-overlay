import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStats } from '../context/StatsContext';
import { useThrottledValue } from '../hooks/useThrottledValue';

type Timeout = ReturnType<typeof setTimeout>;

export const CoordsBox: React.FC = () => {
    const { stats } = useStats();
    const throttledStats = useThrottledValue(stats);
    const [isVisible, setIsVisible] = useState<boolean>(true);
    const lastPosition = useRef<{ x: number; y: number; z: number } | null>(null);
    const hideTimer = useRef<Timeout>();

    useEffect(() => {
        if (!throttledStats) return;

        const currentPos = {
            x: Math.floor(throttledStats.position.x),
            y: Math.floor(throttledStats.position.y),
            z: Math.floor(throttledStats.position.z),
        };

        if (lastPosition.current && (
            currentPos.x !== lastPosition.current.x ||
            currentPos.y !== lastPosition.current.y ||
            currentPos.z !== lastPosition.current.z
        )) {
            setIsVisible(true);
            if (hideTimer.current) {
                clearTimeout(hideTimer.current);
            }
            hideTimer.current = setTimeout(() => setIsVisible(false), 5000);
        }

        lastPosition.current = currentPos;
    }, [throttledStats]);

    useEffect(() => {
        return () => {
            if (hideTimer.current) {
                clearTimeout(hideTimer.current);
            }
        };
    }, []);

    if (!throttledStats) return null;

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    className="fixed bottom-8 right-8 bg-black/50 rounded px-4 py-2 border-2 border-white/30 font-mono"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={{ duration: 0.3 }}
                >
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">📍</span>
                        <div className="text-white font-bold">
                            <span>{Math.floor(throttledStats.position.x)}</span>
                            <span className="mx-1">,</span>
                            <span>{Math.floor(throttledStats.position.y)}</span>
                            <span className="mx-1">,</span>
                            <span>{Math.floor(throttledStats.position.z)}</span>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}; 