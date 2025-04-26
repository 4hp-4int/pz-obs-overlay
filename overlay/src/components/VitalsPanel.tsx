import React from 'react';
import { motion } from 'framer-motion';
import { useStats } from '../context/StatsContext';
import { useThrottledValue } from '../hooks/useThrottledValue';

export const VitalsPanel: React.FC = () => {
    const { stats } = useStats();
    const throttledStats = useThrottledValue(stats);

    if (!throttledStats) return null;

    const healthPercent = throttledStats.health * 100;
    const weightPercent = (throttledStats.stats.inventoryWeight / throttledStats.stats.maxWeight) * 100;

    return (
        <div className="fixed top-8 left-8 space-y-3">
            {/* Health Bar */}
            <div className="flex items-center gap-3">
                <span className="text-2xl min-w-[32px] text-center">❤️</span>
                <div className="w-48 h-6 bg-black/50 border-2 border-white/30 rounded">
                    <motion.div
                        className="h-full bg-red-600"
                        initial={{ width: 0 }}
                        animate={{ width: `${healthPercent}%` }}
                        transition={{ duration: 0.3 }}
                    />
                </div>
                <span className="text-white font-bold min-w-[48px]">{Math.round(healthPercent)}%</span>
            </div>

            {/* Weight Bar */}
            <div className="flex items-center gap-3">
                <span className="text-2xl min-w-[32px] text-center">🎒</span>
                <div className="w-48 h-6 bg-black/50 border-2 border-white/30 rounded">
                    <motion.div
                        className={`h-full ${weightPercent > 90 ? 'bg-red-600' : 'bg-yellow-500'}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${weightPercent}%` }}
                        transition={{ duration: 0.3 }}
                    />
                </div>
                <span className="text-white font-bold min-w-[48px]">
                    {throttledStats.stats.inventoryWeight.toFixed(1)}
                </span>
            </div>

            {/* Equipment */}
            <div className="flex flex-col gap-2 bg-black/50 p-3 rounded border-2 border-white/30">
                <div className="flex items-center gap-3">
                    <span className="text-2xl min-w-[32px] text-center">⚔️</span>
                    <span className="text-white">
                        {throttledStats.equipment.primaryHand?.name || 'Empty'}
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-2xl min-w-[32px] text-center">🛡️</span>
                    <span className="text-white">
                        {throttledStats.equipment.secondaryHand?.name || 'Empty'}
                    </span>
                </div>
            </div>
        </div>
    );
}; 