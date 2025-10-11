import Database from 'better-sqlite3';
import { IntelligentModel } from './intelligent-model';
import { MemoryStorage } from './memory-storage';
import { AppMemory, MemoryCreationRequest, MemoryCompactionRequest } from './memory-types';
import { EnergyRegulator } from './energy';

export class MemorySubAgent {
  private storage: MemoryStorage;
  private intelligentModel: IntelligentModel;
  private energyConsumed: number = 0;
  private debugMode: boolean;
  private dummyEnergyRegulator: EnergyRegulator;

  constructor(db: Database.Database, debugMode: boolean = false) {
    this.storage = new MemoryStorage(db);
    this.intelligentModel = new IntelligentModel();
    this.debugMode = debugMode;
    this.dummyEnergyRegulator = new EnergyRegulator(0);
  }

  async createMemory(request: MemoryCreationRequest): Promise<AppMemory | null> {
    try {
      const startTime = Date.now();
      
      const prompt = this.buildMemoryCreationPrompt(request);
      
      const response = await this.intelligentModel.generateResponse(
        [{ role: 'user', content: prompt }],
        this.dummyEnergyRegulator,
        false,
        [],
        []
      );
      
      const memoryContent = response.content.trim();
      
      if (!memoryContent || memoryContent.length < 10) {
        console.error('❌ Memory creation failed: content too short');
        return null;
      }
      
      const memory = this.storage.insertMemory({
        appId: request.appId,
        content: memoryContent,
        sourceConversationId: request.conversationId,
        metadata: {}
      });
      
      const energyUsed = 15;
      this.trackEnergy(energyUsed);
      
      if (this.debugMode) {
        const elapsed = Date.now() - startTime;
        console.log(`📝 Created memory for app ${request.appId} (${elapsed}ms, ${energyUsed} energy): ${memoryContent.substring(0, 100)}...`);
      }
      
      const count = this.storage.getMemoryCount(request.appId);
      if (count > 10) {
        if (this.debugMode) {
          console.log(`🗜️  Memory count (${count}) exceeds limit, triggering compaction for app ${request.appId}`);
        }
        
        const existingMemories = this.storage.getMemories(request.appId, 11);
        await this.compactMemories({
          appId: request.appId,
          existingMemories: existingMemories.filter(m => m.id !== memory.id),
          newMemory: memory
        });
      }
      
      return memory;
    } catch (error: any) {
      console.error(`❌ Memory creation error: ${error.message}`);
      return null;
    }
  }

  private buildMemoryCreationPrompt(request: MemoryCreationRequest): string {
    return `You are a memory creation assistant. Analyze this conversation and create a concise memory record.

Focus on:
- Key facts and information shared
- User preferences or patterns observed
- Important decisions or outcomes
- Lessons learned or insights gained

Format: Single paragraph, 2-4 sentences, factual and concise. Do not include meta-commentary.

Conversation Summary:
${request.conversationSummary}

User Messages:
${request.userMessages.join('\n')}

Assistant Messages:
${request.assistantMessages.join('\n')}

Create a memory record (2-4 sentences):`;
  }

  async compactMemories(request: MemoryCompactionRequest): Promise<void> {
    try {
      const startTime = Date.now();
      
      const prompt = this.buildCompactionPrompt(request);
      
      const response = await this.intelligentModel.generateResponse(
        [{ role: 'user', content: prompt }],
        this.dummyEnergyRegulator,
        false,
        [],
        []
      );
      
      const decision = this.parseCompactionDecision(response.content);
      
      if (!decision) {
        console.warn('⚠️  Compaction decision parsing failed, using FIFO fallback');
        const oldest = request.existingMemories.sort((a, b) => 
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )[0];
        if (oldest) {
          this.storage.deleteMemory(oldest.id);
        }
        return;
      }
      
      if (decision.action === 'delete') {
        this.storage.deleteMemory(decision.targetMemoryId);
        if (this.debugMode) {
          const elapsed = Date.now() - startTime;
          console.log(`🗜️  Deleted memory ${decision.targetMemoryId} (${elapsed}ms): ${decision.reason}`);
        }
      } else if (decision.action === 'edit' && decision.newContent) {
        this.storage.updateMemory(decision.targetMemoryId, decision.newContent);
        if (this.debugMode) {
          const elapsed = Date.now() - startTime;
          console.log(`🗜️  Updated memory ${decision.targetMemoryId} (${elapsed}ms): ${decision.reason}`);
        }
      }
      
      const energyUsed = 25;
      this.trackEnergy(energyUsed);
      
    } catch (error: any) {
      console.error(`❌ Compaction error: ${error.message}, using FIFO fallback`);
      const oldest = request.existingMemories.sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )[0];
      if (oldest) {
        this.storage.deleteMemory(oldest.id);
      }
    }
  }

  private buildCompactionPrompt(request: MemoryCompactionRequest): string {
    let prompt = `You are a memory management assistant. You have 11 memories but can only keep 10.

Analyze these memories and decide which ONE to either:
1. DELETE (remove entirely if redundant or outdated)
2. EDIT (merge with another or update content if related information can be combined)

Existing memories:\n`;

    request.existingMemories.forEach((memory) => {
      prompt += `\nMemory ${memory.id} (created ${new Date(memory.createdAt).toISOString().split('T')[0]}):\n${memory.content}\n`;
    });

    prompt += `\nNew memory (ID ${request.newMemory.id}):\n${request.newMemory.content}\n`;

    prompt += `\nRespond with JSON only:
{
  "action": "delete" or "edit",
  "targetMemoryId": <id of memory to delete or edit>,
  "newContent": "<merged content if editing, otherwise omit>",
  "reason": "<brief explanation>"
}`;

    return prompt;
  }

  private parseCompactionDecision(content: string): { action: 'delete' | 'edit'; targetMemoryId: number; newContent?: string; reason: string } | null {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return null;
      }
      
      const decision = JSON.parse(jsonMatch[0]);
      
      if (!decision.action || !decision.targetMemoryId || !decision.reason) {
        return null;
      }
      
      if (decision.action !== 'delete' && decision.action !== 'edit') {
        return null;
      }
      
      if (decision.action === 'edit' && !decision.newContent) {
        return null;
      }
      
      return decision;
    } catch (error) {
      return null;
    }
  }

  getMemories(appId: string, limit: number = 10): AppMemory[] {
    return this.storage.getMemories(appId, limit);
  }

  getMemoryCount(appId: string): number {
    return this.storage.getMemoryCount(appId);
  }

  deleteAppMemories(appId: string): number {
    return this.storage.deleteAppMemories(appId);
  }

  deleteMemory(id: number): void {
    this.storage.deleteMemory(id);
  }

  getEnergyConsumedSinceLastPoll(): number {
    const energy = this.energyConsumed;
    this.energyConsumed = 0;
    return energy;
  }

  private trackEnergy(amount: number): void {
    this.energyConsumed += amount;
  }
}
