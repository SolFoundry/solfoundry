import { useState, useEffect, useRef } from 'react';

export interface PRStatus {
  id: string;
  title: string;
  status: 'pending' | 'approved' | 'changes_requested' | 'merged' | 'closed';
  author: string;
  reviewers: string[];
  createdAt: string;
  updatedAt: string;
  repository: string;
  branch: string;
  url: string;
}

export interface UsePRStatusReturn {
  prStatuses: PRStatus[];
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  reconnect: () => void;
  refreshData: () => void;
}

export const usePRStatus = (wsUrl?: string): UsePRStatusReturn => {
  const [prStatuses, setPrStatuses] = useState<PRStatus[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const defaultWsUrl = wsUrl || process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/pr-status';

  const connectWebSocket = () => {
    try {
      wsRef.current = new WebSocket(defaultWsUrl);

      wsRef.current.onopen = () => {
        setIsConnected(true);
        setError(null);
        setIsLoading(false);
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'initial') {
            setPrStatuses(data.data);
          } else if (data.type === 'update') {
            setPrStatuses(prev => {
              const index = prev.findIndex(pr => pr.id === data.data.id);
              if (index >= 0) {
                const updated = [...prev];
                updated[index] = data.data;
                return updated;
              } else {
                return [...prev, data.data];
              }
            });
          } else if (data.type === 'delete') {
            setPrStatuses(prev => prev.filter(pr => pr.id !== data.id));
          }
        } catch (parseError) {
          console.error('Error parsing WebSocket message:', parseError);
        }
      };

      wsRef.current.onclose = () => {
        setIsConnected(false);
        // Attempt to reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, 3000);
      };

      wsRef.current.onerror = (event) => {
        setError('WebSocket connection error');
        setIsLoading(false);
      };
    } catch (connectionError) {
      setError('Failed to establish WebSocket connection');
      setIsLoading(false);
    }
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  };

  const reconnect = () => {
    disconnect();
    setIsLoading(true);
    setError(null);
    connectWebSocket();
  };

  const refreshData = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'refresh' }));
    }
  };

  useEffect(() => {
    connectWebSocket();

    return () => {
      disconnect();
    };
  }, [defaultWsUrl]);

  return {
    prStatuses,
    isConnected,
    isLoading,
    error,
    reconnect,
    refreshData
  };
};