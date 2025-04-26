import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface XPGainItem {
    perk: string;
    amount: number;
    level?: number;
}

interface XPGainProps {
    gains: XPGainItem[];
}

// Map perks to emojis (you might want to replace these with actual icons)
const perkIcons: Record<string, string> = {
    Strength: '💪',
    Fitness: '🏃',
    Sprinting: '🏃‍♂️',
    Lightfoot: '🦶',
    Nimble: '🤸',
    Sneak: '🤫',
    Axe: '🪓',
    LongBlade: '⚔️',
    ShortBlade: '🗡️',
    Spear: '🔱',
    Maintenance: '🔧',
    Carpentry: '🔨',
    Cooking: '👨‍🍳',
    Farming: '🌱',
    FirstAid: '🩹',
    Electrical: '⚡',
    MetalWelding: '🔥',
    Mechanics: '🚗',
    Tailoring: '🧵',
    Aiming: '🎯',
    Reloading: '🔫',
    Fishing: '🎣',
    Trapping: '🪤',
    Foraging: '🌿',
    Blunt: '🔨'
};

export const XPGain: React.FC<XPGainProps> = ({ gains }) => {
    // Sort gains by amount (largest first)
    const sortedGains = [...gains].sort((a, b) => b.amount - a.amount);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
                duration: 0.3,
                ease: "easeInOut"
            }}
            className="glass rounded-lg p-3 text-white transform-gpu"
        >
            <div className="space-y-2">
                <AnimatePresence mode="popLayout">
                    {sortedGains.map((gain, index) => (
                        <motion.div
                            key={`${gain.perk}-${index}`}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="flex items-center space-x-3"
                        >
                            <div className="w-8 h-8 rounded bg-black/30 flex items-center justify-center text-xl">
                                {perkIcons[gain.perk] || '📚'}
                            </div>
                            <div>
                                <div className="flex items-baseline space-x-2">
                                    <span className="font-bold">{gain.perk}</span>
                                    <span className="text-sm text-green-400">
                                        +{gain.amount.toFixed(2)} XP
                                    </span>
                                </div>
                                {gain.level && (
                                    <div className="text-xs text-yellow-400">
                                        Level {gain.level}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </motion.div>
    );
}; 