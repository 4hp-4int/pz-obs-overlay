import React from 'react';
import { StatsProvider, useStats } from './context/StatsContext';
import { useWebSocket } from './hooks/useWebSocket';
import { VitalsPanel } from './components/VitalsPanel';
import { EnvironmentBadge } from './components/EnvironmentBadge';
import { CoordsBox } from './components/CoordsBox';
import './index.css';

const WS_URL = 'ws://localhost:8080';

function App() {
    const { updateStats } = useStats();

    const { isConnected } = useWebSocket({
        url: WS_URL,
        onMessage: (data) => {
            if (data.type === 'state' && data.player) {
                updateStats(data.player);
            }
        }
    });

    return (
        <div className="relative w-screen h-screen pointer-events-none select-none">
            <VitalsPanel />
            <EnvironmentBadge />
            <CoordsBox />

            {!isConnected && (
                <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black/50 backdrop-blur-sm rounded-xl px-4 py-2 shadow-lg border border-red-500/20">
                    <span className="text-sm text-red-500">Disconnected from server</span>
                </div>
            )}
        </div>
    );
}

export default function AppWrapper() {
    return (
        <StatsProvider>
            <App />
        </StatsProvider>
    );
}
