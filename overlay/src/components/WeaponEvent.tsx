import React from 'react';
import { motion } from 'framer-motion';

interface WeaponEventProps {
    event: {
        type: 'attack' | 'hit';
        itemName: string;
        itemType: string;
        hit?: boolean;
    };
}

export const WeaponEvent: React.FC<WeaponEventProps> = ({ event }) => {
    const isHit = event.type === 'hit' || event.hit;

    return (
        <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            className={`rounded-lg p-3 text-white ${isHit ? 'bg-red-500/80' : 'bg-gray-800/80'
                }`}
        >
            <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-black/30 rounded flex items-center justify-center">
                    {/* You could use actual weapon icons here */}
                    🗡️
                </div>
                <div>
                    <div className="font-bold">{event.itemName}</div>
                    <div className="text-sm opacity-80">
                        {isHit ? 'Hit landed!' : 'Swing'}
                    </div>
                </div>
            </div>
        </motion.div>
    );
}; 