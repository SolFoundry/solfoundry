import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export function useSocket<T>(eventName: string, onEvent: (data: T) => void) {
  const [isConnected, setIsConnected] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    // Graceful fallback to polling if WebSocket fails
    const socketInstance = io(API_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    setSocket(socketInstance);

    socketInstance.on('connect', () => {
      setIsConnected(true);
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
    });

    socketInstance.on(eventName, (data: T) => {
      onEvent(data);
    });

    return () => {
      socketInstance.off(eventName);
      socketInstance.disconnect();
    };
  }, [eventName, onEvent]);

  return { isConnected, socket };
}
