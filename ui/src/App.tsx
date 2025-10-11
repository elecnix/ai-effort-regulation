import { useState, useEffect } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { SystemHealth } from './components/SystemHealth';
import { ConversationList } from './components/ConversationList';
import { ChatPanel } from './components/ChatPanel';
import { EventStream } from './components/EventStream';
import { 
  ConversationSummary, 
  ConversationDetail, 
  SystemStats, 
  WebSocketMessage 
} from './types/websocket';

function App() {
  const ws = useWebSocket('ws://localhost:6740/ws');
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<ConversationDetail | null>(null);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [energy, setEnergy] = useState({
    current: 100,
    max: 100,
    min: -50,
    status: 'high' as const
  });
  const [events, setEvents] = useState<WebSocketMessage[]>([]);

  useEffect(() => {
    if (ws.isConnected) {
      ws.getConversations(50);
      ws.getStats();
    }
  }, [ws.isConnected]);

  useEffect(() => {
    const unsubscribe = ws.on('*', (message: WebSocketMessage) => {
      setEvents(prev => [...prev.slice(-99), message]);
    });

    return unsubscribe;
  }, [ws]);

  useEffect(() => {
    const unsubscribe = ws.on('energy_update', (payload) => {
      setEnergy({
        current: payload.current,
        max: payload.max,
        min: payload.min,
        status: payload.status
      });
    });

    return unsubscribe;
  }, [ws]);

  useEffect(() => {
    const unsubscribe = ws.on('system_stats', (payload: SystemStats) => {
      setStats(payload);
    });

    return unsubscribe;
  }, [ws]);

  useEffect(() => {
    const unsubscribe = ws.on('conversations_list', (payload) => {
      setConversations(payload.conversations);
    });

    return unsubscribe;
  }, [ws]);

  useEffect(() => {
    const unsubscribe = ws.on('conversation_detail', (payload: ConversationDetail) => {
      setSelectedConversation(payload);
    });

    return unsubscribe;
  }, [ws]);

  useEffect(() => {
    const unsubscribe = ws.on('conversation_created', (payload) => {
      ws.getConversations(50);
      setSelectedConversationId(payload.conversationId);
      ws.getConversation(payload.conversationId);
    });

    return unsubscribe;
  }, [ws]);

  useEffect(() => {
    const unsubscribe = ws.on('message_added', (payload) => {
      if (payload.conversationId === selectedConversationId) {
        ws.getConversation(payload.conversationId);
      }
      ws.getConversations(50);
    });

    return unsubscribe;
  }, [ws, selectedConversationId]);

  useEffect(() => {
    const unsubscribe = ws.on('conversation_state_changed', () => {
      ws.getConversations(50);
    });

    return unsubscribe;
  }, [ws]);

  const handleSelectConversation = (id: string) => {
    setSelectedConversationId(id);
    ws.getConversation(id);
  };

  const handleSendMessage = (content: string, energyBudget?: number) => {
    ws.sendMessage(content, energyBudget);
  };

  return (
    <div className="h-screen flex flex-col">
      <SystemHealth stats={stats} energy={energy} />
      
      <div className="flex-1 flex overflow-hidden">
        <div className="w-80 flex-shrink-0">
          <ConversationList
            conversations={conversations}
            selectedId={selectedConversationId}
            onSelect={handleSelectConversation}
          />
        </div>

        <div className="flex-1">
          <ChatPanel
            conversation={selectedConversation}
            onSendMessage={handleSendMessage}
            isConnected={ws.isConnected}
          />
        </div>

        <div className="w-96 flex-shrink-0">
          <EventStream events={events} />
        </div>
      </div>
    </div>
  );
}

export default App;
