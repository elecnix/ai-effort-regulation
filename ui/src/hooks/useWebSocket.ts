import { useEffect, useRef, useState, useCallback } from 'react';
import { WebSocketMessage } from '../types/websocket';

export function useWebSocket(_url?: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttempts = useRef(0);
  const listenersRef = useRef<Map<string, Set<(payload: any) => void>>>(new Map());

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;

    console.log('Connecting to WebSocket:', wsUrl);
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      reconnectAttempts.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        setLastMessage(message);

        const listeners = listenersRef.current.get(message.type);
        if (listeners) {
          listeners.forEach(listener => listener(message.payload));
        }

        const allListeners = listenersRef.current.get('*');
        if (allListeners) {
          allListeners.forEach(listener => listener(message));
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
      wsRef.current = null;

      const delay = Math.min(30000, 1000 * Math.pow(2, reconnectAttempts.current));
      reconnectAttempts.current++;
      
      console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current})`);
      reconnectTimeoutRef.current = setTimeout(connect, delay);
    };

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const send = useCallback((message: Omit<WebSocketMessage, 'timestamp'>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const fullMessage: WebSocketMessage = {
        ...message,
        timestamp: new Date().toISOString()
      };
      wsRef.current.send(JSON.stringify(fullMessage));
    } else {
      console.error('WebSocket is not connected');
    }
  }, []);

  const on = useCallback((type: string, listener: (payload: any) => void) => {
    if (!listenersRef.current.has(type)) {
      listenersRef.current.set(type, new Set());
    }
    listenersRef.current.get(type)!.add(listener);

    return () => {
      const listeners = listenersRef.current.get(type);
      if (listeners) {
        listeners.delete(listener);
      }
    };
  }, []);

  const sendMessage = useCallback((content: string, energyBudget?: number) => {
    send({
      type: 'send_message',
      payload: { content, energyBudget }
    });
  }, [send]);

  const getConversations = useCallback((limit?: number) => {
    send({
      type: 'get_conversations',
      payload: { limit }
    });
  }, [send]);

  const getConversation = useCallback((conversationId: string) => {
    send({
      type: 'get_conversation',
      payload: { conversationId }
    });
  }, [send]);

  const getStats = useCallback(() => {
    send({
      type: 'get_stats',
      payload: {}
    });
  }, [send]);

  return {
    isConnected,
    lastMessage,
    send,
    on,
    sendMessage,
    getConversations,
    getConversation,
    getStats
  };
}
