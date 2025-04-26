import { useState, useEffect, useCallback } from 'react';

interface UseWebSocketOptions {
    onMessage?: (data: any) => void;
    reconnectInterval?: number;
    maxReconnectAttempts?: number;
}

export function useWebSocket(url: string, options: UseWebSocketOptions = {}) {
    const [socket, setSocket] = useState<WebSocket | null>(null);
    const [lastMessage, setLastMessage] = useState<MessageEvent | null>(null);
    const [reconnectAttempt, setReconnectAttempt] = useState(0);
    const {
        onMessage,
        reconnectInterval = 5000,
        maxReconnectAttempts = 50
    } = options;

    const connect = useCallback(() => {
        try {
            const ws = new WebSocket(url);

            ws.onopen = () => {
                console.log('WebSocket connected');
                setReconnectAttempt(0);
            };

            ws.onmessage = (event) => {
                setLastMessage(event);
                if (onMessage) {
                    try {
                        const data = JSON.parse(event.data);
                        onMessage(data);
                    } catch (e) {
                        console.error('Failed to parse WebSocket message:', e);
                    }
                }
            };

            ws.onclose = () => {
                console.log('WebSocket disconnected');
                setSocket(null);

                // Attempt to reconnect if we haven't exceeded max attempts
                if (reconnectAttempt < maxReconnectAttempts) {
                    setTimeout(() => {
                        setReconnectAttempt(prev => prev + 1);
                        connect();
                    }, reconnectInterval);
                }
            };

            ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };

            setSocket(ws);
        } catch (error) {
            console.error('Failed to create WebSocket:', error);
            // Attempt to reconnect on connection error
            if (reconnectAttempt < maxReconnectAttempts) {
                setTimeout(() => {
                    setReconnectAttempt(prev => prev + 1);
                    connect();
                }, reconnectInterval);
            }
        }
    }, [url, onMessage, reconnectAttempt, reconnectInterval, maxReconnectAttempts]);

    useEffect(() => {
        connect();

        return () => {
            if (socket) {
                socket.close();
            }
        };
    }, [connect]);

    const sendMessage = useCallback((data: string | object) => {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(typeof data === 'string' ? data : JSON.stringify(data));
        }
    }, [socket]);

    return {
        socket,
        lastMessage,
        sendMessage,
        isConnected: socket?.readyState === WebSocket.OPEN,
        reconnectAttempt
    };
} 