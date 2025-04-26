import React from 'react';

interface PlayerStatsProps {
    playerData: {
        health: number;
        moodles: Record<string, number>;
    };
}

export const PlayerStats: React.FC<PlayerStatsProps> = ({ playerData }) => {
    return (
        <div className="bg-black/50 rounded-lg p-4 text-white">
            {/* Health Bar */}
            <div className="mb-4">
                <div className="text-sm mb-1">Health</div>
                <div className="w-48 h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-green-500 transition-all duration-300"
                        style={{ width: `${playerData.health * 100}%` }}
                    />
                </div>
            </div>

            {/* Moodles */}
            <div className="grid grid-cols-2 gap-2">
                {Object.entries(playerData.moodles).map(([moodle, level]) => (
                    level > 0 && (
                        <div key={moodle} className="flex items-center space-x-2">
                            <div className="w-6 h-6 rounded bg-gray-700 flex items-center justify-center">
                                {/* You could use actual moodle icons here */}
                                ⚡
                            </div>
                            <div>
                                <div className="text-sm">{moodle}</div>
                                <div className="text-xs opacity-70">Level {level}</div>
                            </div>
                        </div>
                    )
                ))}
            </div>
        </div>
    );
}; 