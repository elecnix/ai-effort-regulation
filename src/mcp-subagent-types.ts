/**
 * Type definitions for MCP Sub-Agent communication
 * These types define the interface between the main SensitiveLoop and the MCP Sub-Agent
 */

export type SubAgentRequestType = 
  | 'add_server' 
  | 'remove_server' 
  | 'test_server' 
  | 'list_servers'
  | 'search_servers';

export type SubAgentRequestPriority = 'low' | 'medium' | 'high';

export type SubAgentRequestState = 
  | 'queued' 
  | 'in_progress' 
  | 'completed' 
  | 'failed' 
  | 'cancelled';

export interface SubAgentRequest {
  id: string;
  type: SubAgentRequestType;
  params: Record<string, any>;
  timestamp: Date;
  priority: SubAgentRequestPriority;
}

export interface SubAgentStatus {
  requestId: string;
  state: SubAgentRequestState;
  progress: number;
  message: string;
  startTime: Date;
  endTime?: Date;
  result?: any;
  error?: string;
}

export type SubAgentMessageType = 
  | 'status_update' 
  | 'completion' 
  | 'error' 
  | 'log';

export interface SubAgentMessage {
  type: SubAgentMessageType;
  requestId: string;
  timestamp: Date;
  data: any;
}

export interface SubAgentMetrics {
  totalRequests: number;
  completedRequests: number;
  failedRequests: number;
  activeRequests: number;
  averageProcessingTime: number;
}

export interface MCPServerConfig {
  id: string;
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  enabled: boolean;
}
