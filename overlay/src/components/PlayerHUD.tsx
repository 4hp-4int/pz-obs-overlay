import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XPGain } from './XPGain';

interface PlayerData {
    health: number;
    position: { x: number; y: number; z: number };
    moodles: Record<string, number>;
}

interface XPGainItem {
    perk: string;
    amount: number;
    level?: number;
}

interface PlayerHUDProps {
    playerData: PlayerData;
    xpGains: XPGainItem[];
}

// Map moodle levels to colors
const moodleColors: Record<number, string> = {
    1: 'bg-yellow-500',
    2: 'bg-orange-500',
    3: 'bg-red-500',
    4: 'bg-purple-500'
};

// Map moodle names to emojis (you might want to replace these with actual icons)
const moodleIcons: Record<string, string> = {
    Hungry: '🍖',
    Thirsty: '💧',
    Tired: '😴',
    Sick: '🤒',
    Injured: '🤕',
    Wet: '💦',
    Bleeding: '🩸',
    Drunk: '🍺',
    Stress: '😰',
    Pain: '💊'
};

// Map perks to emojis
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

export const PlayerHUD: React.FC<PlayerHUDProps> = ({ playerData, xpGains }) => {
    const activeMoodles = Object.entries(playerData.moodles);
    const healthPercentage = Math.max(0, Math.min(100, playerData.health * 100));

    return (
        <div className="space-y-4">
            {/* Health Bar */}
            <div className="space-y-1">
                <motion.div
                    className="flex justify-between items-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.1 }}
                >
                    <span className="text-sm font-semibold text-white">Health</span>
                    <span className="text-sm text-white">{Math.round(healthPercentage)}%</span>
                </motion.div>
                <div className="h-1.5 bg-gray-700/50 rounded-full overflow-hidden">
                    <motion.div
                        className="h-full bg-red-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${healthPercentage}%` }}
                        transition={{
                            duration: 0.5,
                            ease: "easeOut"
                        }}
                    />
                </div>
            </div>

            {/* Active Moodles */}
            <AnimatePresence mode="popLayout">
                {activeMoodles.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="grid grid-cols-2 gap-1.5"
                    >
                        {activeMoodles.map(([moodle, level]) => (
                            <motion.div
                                key={moodle}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                transition={{ duration: 0.2 }}
                                className={`${moodleColors[level] || 'bg-gray-600'} bg-opacity-50 rounded p-1.5 flex items-center space-x-2 transform-gpu`}
                            >
                                <span className="text-base" role="img" aria-label={moodle}>
                                    {moodleIcons[moodle] || '❓'}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <div className="text-xs font-medium text-white truncate">
                                        {moodle}
                                    </div>
                                    <div className="text-[10px] text-white/75">
                                        Level {level}
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* XP Gains */}
            <XPGain gains={xpGains} />
        </div>
    );
}; 