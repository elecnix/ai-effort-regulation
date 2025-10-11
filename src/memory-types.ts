export interface AppMemory {
  id: number;
  appId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  sourceConversationId?: string;
  metadata?: {
    importance?: number;
    tags?: string[];
    relatedConversations?: string[];
  };
}

export interface MemoryCreationRequest {
  appId: string;
  conversationId: string;
  conversationSummary: string;
  userMessages: string[];
  assistantMessages: string[];
}

export interface MemoryCompactionRequest {
  appId: string;
  existingMemories: AppMemory[];
  newMemory: AppMemory;
}

export interface MemoryCompactionDecision {
  action: 'delete' | 'edit';
  targetMemoryId: number;
  newContent?: string;
  reason: string;
}
