import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface PlayerStats {
    health: number;
    position: {
        x: number;
        y: number;
        z: number;
    };
    state: {
        isOutside: boolean;
        isAsleep: boolean;
        isResting: boolean;
        isWearingGloves: boolean;
        isWearingGlasses: boolean;
        isWearingVisualAid: boolean;
        isDisguised: boolean;
        isWeaponReady: boolean;
        isCurrentlyIdle: boolean;
        isCurrentlyBusy: boolean;
    };
    stats: {
        hoursSurvived: number;
        zombieKills: number;
        inventoryWeight: number;
        maxWeight: number;
        levelUpMultiplier: number;
        numSurvivorsInVicinity: number;
    };
    equipment: {
        primaryHand: {
            name: string;
            texture: string;
        } | null;
        secondaryHand: {
            name: string;
            texture: string;
        } | null;
    };
}

interface StatsContextType {
    stats: PlayerStats | null;
    updateStats: (newStats: PlayerStats) => void;
}

const StatsContext = createContext<StatsContextType | undefined>(undefined);

export const StatsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [stats, setStats] = useState<PlayerStats | null>(null);

    const updateStats = useCallback((newStats: PlayerStats) => {
        setStats(newStats);
    }, []);

    const value = useMemo(() => ({
        stats,
        updateStats,
    }), [stats, updateStats]);

    return (
        <StatsContext.Provider value={value}>
            {children}
        </StatsContext.Provider>
    );
};

export const useStats = () => {
    const context = useContext(StatsContext);
    if (context === undefined) {
        throw new Error('useStats must be used within a StatsProvider');
    }
    return context;
}; 