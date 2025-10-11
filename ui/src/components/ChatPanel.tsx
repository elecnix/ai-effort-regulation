import { useState, useRef, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { ConversationDetail } from '../types/websocket';

interface ChatPanelProps {
  conversation: ConversationDetail | null;
  onSendMessage: (content: string, energyBudget?: number) => void;
  isConnected: boolean;
}

export function ChatPanel({ conversation, onSendMessage, isConnected }: ChatPanelProps) {
  const [message, setMessage] = useState('');
  const [energyBudget, setEnergyBudget] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversation?.responses]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !isConnected) return;

    const budget = energyBudget ? parseFloat(energyBudget) : undefined;
    onSendMessage(message, budget);
    setMessage('');
    setEnergyBudget('');
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-semibold">
          {conversation ? 'Conversation' : 'New Conversation'}
        </h2>
        {conversation && (
          <p className="text-sm text-muted-foreground truncate">
            {conversation.inputMessage}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
        {!conversation ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <Send className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Send a message to start a conversation</p>
            </div>
          </div>
        ) : (
          <>
            <div className="bg-accent/50 rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-1">User</div>
              <div className="text-sm">{conversation.inputMessage}</div>
              {conversation.metadata.energyBudget !== null && (
                <div className="text-xs text-muted-foreground mt-2">
                  Budget: {conversation.metadata.energyBudget} | 
                  Remaining: {conversation.metadata.energyBudgetRemaining?.toFixed(1)} | 
                  Status: {conversation.metadata.budgetStatus}
                </div>
              )}
            </div>

            {conversation.responses.map((response, idx) => (
              <div key={idx} className="bg-card rounded-lg p-3 border border-border">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-muted-foreground">Assistant</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{response.modelUsed}</span>
                    <span>•</span>
                    <span>Energy: {response.energyLevel}</span>
                    <span>•</span>
                    <span>{new Date(response.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>
                <div className="text-sm whitespace-pre-wrap">{response.content}</div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <div className="p-4 border-t border-border">
        <form onSubmit={handleSubmit} className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 px-3 py-2 bg-secondary border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={!isConnected}
            />
            <input
              type="number"
              value={energyBudget}
              onChange={(e) => setEnergyBudget(e.target.value)}
              placeholder="Budget"
              min="0"
              className="w-24 px-3 py-2 bg-secondary border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={!isConnected}
            />
            <button
              type="submit"
              disabled={!message.trim() || !isConnected}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isConnected ? <Send className="w-4 h-4" /> : <Loader2 className="w-4 h-4 animate-spin" />}
            </button>
          </div>
          <div className="text-xs text-muted-foreground">
            {isConnected ? 'Connected' : 'Connecting...'}
            {energyBudget && ` • Budget: ${energyBudget}`}
          </div>
        </form>
      </div>
    </div>
  );
}
