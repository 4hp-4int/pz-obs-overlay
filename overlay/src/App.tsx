import React, { useEffect, useState } from 'react';
import { PlayerHUD } from './components/PlayerHUD';

interface XPGainItem {
    perk: string;
    amount: number;
    level?: number;
}

interface PlayerState {
    health: number;
    position: { x: number; y: number; z: number };
    moodles: Record<string, number>;
}

function App() {
    const [xpGains, setXpGains] = useState<XPGainItem[]>([]);
    const [playerData, setPlayerData] = useState<PlayerState>({
        health: 1,
        position: { x: 0, y: 0, z: 0 },
        moodles: {}
    });

    useEffect(() => {
        const ws = new WebSocket('ws://localhost:8080');

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.type === 'xp') {
                setXpGains(prev => [...prev, {
                    perk: data.skill,
                    amount: data.amount,
                    level: data.level
                }]);

                // Remove the XP gain notification after 3 seconds
                setTimeout(() => {
                    setXpGains(prev => prev.slice(1));
                }, 3000);
            } else if (data.type === 'state') {
                setPlayerData(data.state);
            }
        };

        return () => ws.close();
    }, []);

    return (
        <div className="fixed inset-0 pointer-events-none">
            <div className="absolute top-4 right-4 w-64">
                <PlayerHUD playerData={playerData} xpGains={xpGains} />
            </div>
        </div>
    );
}

export default App; 