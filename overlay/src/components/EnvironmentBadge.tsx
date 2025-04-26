import React from 'react';
import { motion } from 'framer-motion';
import { useStats } from '../context/StatsContext';
import { useThrottledValue } from '../hooks/useThrottledValue';

export const EnvironmentBadge: React.FC = () => {
    const { stats } = useStats();
    const throttledStats = useThrottledValue(stats);

    if (!throttledStats) return null;

    const isOutside = throttledStats.state.isOutside;

    return (
        <motion.div
            className="fixed top-8 right-8 flex items-center gap-3 px-4 py-2 rounded bg-black/50 border-2 border-white/30"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
        >
            <motion.span
                animate={{ rotate: isOutside ? [0, 360] : [360, 0] }}
                transition={{ duration: 1, ease: "easeInOut" }}
                className="text-2xl"
            >
                {isOutside ? '☀️' : '🏠'}
            </motion.span>
            <span className="text-white font-bold tracking-wide min-w-[80px] text-center">
                {isOutside ? 'OUTSIDE' : 'INSIDE'}
            </span>
        </motion.div>
    );
}; 