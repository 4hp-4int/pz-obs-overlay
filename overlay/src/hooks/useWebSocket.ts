import { useEffect, useRef, useState } from 'react';

interface UseWebSocketOptions {
    url: string;
    onMessage?: (data: any) => void;
}

export function useWebSocket({ url, onMessage }: UseWebSocketOptions) {
    const [isConnected, setIsConnected] = useState(false);
    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        // Only create a new connection if we don't have one
        if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
            wsRef.current = new WebSocket(url);

            wsRef.current.onopen = () => {
                setIsConnected(true);
            };

            wsRef.current.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    onMessage?.(data);
                } catch (error) {
                    console.error('Error parsing message:', error);
                }
            };

            wsRef.current.onclose = () => {
                setIsConnected(false);
            };
        }

        // Only cleanup when component is actually unmounting
        return () => {
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
        };
    }, []); // Empty dependency array - we only want to create the connection once

    return { isConnected };
} 