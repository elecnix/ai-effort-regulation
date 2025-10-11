export interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: string;
  id?: string;
}

export interface EnergyUpdate {
  current: number;
  max: number;
  min: number;
  percentage: number;
  status: 'high' | 'medium' | 'low' | 'urgent';
  delta: number;
}

export interface ConversationCreated {
  conversationId: string;
  userMessage: string;
  energyBudget: number | null;
  timestamp: string;
}

export interface MessageAdded {
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  energyLevel: number;
  modelUsed: string;
  timestamp: string;
}

export interface ConversationStateChanged {
  conversationId: string;
  oldState: string;
  newState: string;
  reason?: string;
  snoozeUntil?: string;
}

export interface ModelSwitched {
  from: string;
  to: string;
  reason: string;
  energyLevel: number;
}

export interface SleepStart {
  reason: string;
  energyLevel: number;
  expectedDuration: number;
}

export interface SleepEnd {
  duration: number;
  energyRestored: number;
  newEnergyLevel: number;
}

export interface ToolInvocation {
  conversationId: string;
  toolName: string;
  arguments: any;
  result?: any;
  error?: string;
  duration: number;
}

export interface SystemStats {
  totalConversations: number;
  activeConversations?: number;
  snoozedConversations?: number;
  totalResponses: number;
  avgEnergyLevel: number;
  currentEnergy: number;
  modelSwitches?: number;
  sleepCycles?: number;
  uptime: number;
}

export interface ConversationSummary {
  id: string;
  userMessage: string;
  state: string;
  messageCount: number;
  energyConsumed: number;
  lastActivity: string;
}

export interface ConversationDetail {
  requestId: string;
  inputMessage: string;
  responses: Array<{
    timestamp: string;
    content: string;
    energyLevel: number;
    modelUsed: string;
  }>;
  metadata: {
    totalEnergyConsumed: number;
    sleepCycles: number;
    modelSwitches: number;
    energyBudget: number | null;
    energyBudgetRemaining: number | null;
    budgetStatus: string | null;
  };
}

export type EventType = 
  | 'connected'
  | 'energy_update'
  | 'conversation_created'
  | 'message_added'
  | 'conversation_state_changed'
  | 'model_switched'
  | 'sleep_start'
  | 'sleep_end'
  | 'tool_invocation'
  | 'system_stats'
  | 'conversations_list'
  | 'conversation_detail'
  | 'message_sent'
  | 'error';
