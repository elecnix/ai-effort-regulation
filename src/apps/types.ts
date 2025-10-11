export interface AppConfig {
  id: string;
  name: string;
  description?: string;
  type: 'in-process' | 'http' | 'mcp';
  version?: string;
  config?: Record<string, any>;
  enabled: boolean;
  endpoint?: string;
  hourlyEnergyBudget?: number;
  dailyEnergyBudget?: number;
  metadata?: Record<string, any>;
}

export interface AppEnergyMetrics {
  total: number;
  last24h: number;
  last1h: number;
  last1min: number;
}

export interface AppMessage {
  conversationId: string;
  from: string;
  to: string;
  content: any;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface AppStatus {
  id: string;
  name: string;
  enabled: boolean;
  running: boolean;
  energy: AppEnergyMetrics;
  conversations: {
    active: number;
    total: number;
  };
  lastActive?: Date;
  health: 'healthy' | 'degraded' | 'unhealthy';
}

export interface App {
  id: string;
  name: string;
  
  install(config: AppConfig): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  uninstall(): Promise<void>;
  
  sendMessage(message: AppMessage): Promise<void>;
  receiveMessage(message: AppMessage): Promise<void>;
  
  reportEnergyConsumption(amount: number, conversationId?: string, operation?: string): void;
  getStatus(): Promise<AppStatus>;
}

export interface EnergyEvent {
  timestamp: number;
  amount: number;
  conversationId?: string;
  operation?: string;
}
