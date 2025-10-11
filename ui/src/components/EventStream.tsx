import { useEffect, useRef } from 'react';
import { Activity, Zap, MessageSquare, RefreshCw, Moon, Sun, Wrench } from 'lucide-react';
import { WebSocketMessage } from '../types/websocket';

interface EventStreamProps {
  events: WebSocketMessage[];
}

export function EventStream({ events }: EventStreamProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'energy_update':
        return <Zap className="w-4 h-4 text-yellow-500" />;
      case 'conversation_created':
      case 'message_added':
        return <MessageSquare className="w-4 h-4 text-blue-500" />;
      case 'model_switched':
        return <RefreshCw className="w-4 h-4 text-purple-500" />;
      case 'sleep_start':
        return <Moon className="w-4 h-4 text-indigo-500" />;
      case 'sleep_end':
        return <Sun className="w-4 h-4 text-orange-500" />;
      case 'tool_invocation':
        return <Wrench className="w-4 h-4 text-green-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'energy_update':
        return 'border-l-yellow-500';
      case 'conversation_created':
      case 'message_added':
        return 'border-l-blue-500';
      case 'model_switched':
        return 'border-l-purple-500';
      case 'sleep_start':
        return 'border-l-indigo-500';
      case 'sleep_end':
        return 'border-l-orange-500';
      case 'tool_invocation':
        return 'border-l-green-500';
      case 'error':
        return 'border-l-red-500';
      default:
        return 'border-l-gray-500';
    }
  };

  const formatEventContent = (event: WebSocketMessage) => {
    switch (event.type) {
      case 'energy_update':
        return `Energy: ${event.payload.current.toFixed(0)} (${event.payload.delta > 0 ? '+' : ''}${event.payload.delta.toFixed(1)})`;
      case 'conversation_created':
        return `New: "${event.payload.userMessage.substring(0, 50)}..."`;
      case 'message_added':
        return `${event.payload.role}: "${event.payload.content.substring(0, 50)}..."`;
      case 'model_switched':
        return `${event.payload.from} → ${event.payload.to}`;
      case 'sleep_start':
        return `Sleep: ${event.payload.reason}`;
      case 'sleep_end':
        return `Awake: +${event.payload.energyRestored.toFixed(1)} energy`;
      case 'tool_invocation':
        return `Tool: ${event.payload.toolName}`;
      case 'connected':
        return 'Connected to server';
      case 'system_stats':
        return `Stats: ${event.payload.totalConversations} convos, ${event.payload.currentEnergy.toFixed(0)} energy`;
      case 'error':
        return `Error: ${event.payload.message}`;
      default:
        return event.type;
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  return (
    <div className="h-full flex flex-col bg-card border-l border-border">
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Event Stream
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {events.length} events
        </p>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-1">
        {events.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No events yet</p>
            <p className="text-xs mt-1">Events will appear here</p>
          </div>
        ) : (
          events.map((event, idx) => (
            <div
              key={idx}
              className={`p-2 rounded border-l-4 ${getEventColor(event.type)} bg-accent/30 hover:bg-accent/50 transition-colors`}
            >
              <div className="flex items-start gap-2">
                <div className="mt-0.5">{getEventIcon(event.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">
                    {formatEventContent(event)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatTime(event.timestamp)}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}
