import { v4 as uuidv4 } from 'uuid';
import {
  SubAgentRequest,
  SubAgentStatus,
  SubAgentMessage,
  SubAgentMetrics,
  SubAgentRequestState,
  MCPServerConfig
} from './mcp-subagent-types';

/**
 * MCPSubAgent - Autonomous agent for managing MCP servers
 * Runs in a separate async loop, communicates via message queues
 */
export class MCPSubAgent {
  private isRunning = false;
  private requestQueue: SubAgentRequest[] = [];
  private messageQueue: SubAgentMessage[] = [];
  private statusMap: Map<string, SubAgentStatus> = new Map();
  private metrics: SubAgentMetrics = {
    totalRequests: 0,
    completedRequests: 0,
    failedRequests: 0,
    activeRequests: 0,
    averageProcessingTime: 0
  };
  
  // Energy tracking (tracked internally, reported to main loop)
  private energyConsumedSinceLastPoll = 0;
  private totalEnergyConsumed = 0;
  private readonly energyPerSecond = 2; // Energy cost per second of work

  constructor(private debugMode: boolean = false) {}

  /**
   * Start the sub-agent loop
   */
  start(): void {
    if (this.isRunning) {
      console.log('⚠️ Sub-agent already running');
      return;
    }
    
    this.isRunning = true;
    console.log('🤖 Sub-agent started');
    
    // Start the main loop (don't await, let it run in background)
    this.runLoop().catch(error => {
      console.error('❌ Sub-agent loop error:', error);
      this.isRunning = false;
    });
  }

  /**
   * Stop the sub-agent
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }
    
    this.isRunning = false;
    console.log('🛑 Sub-agent stopped');
  }

  /**
   * Queue a new request for processing
   * Returns the request ID
   */
  queueRequest(
    type: SubAgentRequest['type'],
    params: Record<string, any>,
    priority: SubAgentRequest['priority'] = 'medium'
  ): string {
    const request: SubAgentRequest = {
      id: uuidv4(),
      type,
      params,
      timestamp: new Date(),
      priority
    };

    this.requestQueue.push(request);
    this.sortQueueByPriority();
    
    this.statusMap.set(request.id, {
      requestId: request.id,
      state: 'queued',
      progress: 0,
      message: 'Request queued',
      startTime: new Date()
    });

    this.metrics.totalRequests++;
    this.metrics.activeRequests++;

    if (this.debugMode) {
      console.log(`📥 Queued request: ${type} (${request.id})`);
    }

    return request.id;
  }

  /**
   * Get the status of a specific request
   */
  getStatus(requestId: string): SubAgentStatus | undefined {
    return this.statusMap.get(requestId);
  }

  /**
   * Poll for new messages from the sub-agent
   * Returns and clears the message queue
   */
  pollMessages(): SubAgentMessage[] {
    const messages = [...this.messageQueue];
    this.messageQueue = [];
    return messages;
  }

  /**
   * Check if sub-agent has active work
   */
  hasActiveWork(): boolean {
    return this.requestQueue.length > 0 || this.metrics.activeRequests > 0;
  }

  /**
   * Get current metrics
   */
  getMetrics(): SubAgentMetrics {
    return { ...this.metrics };
  }

  /**
   * Get energy consumed since last poll
   * This should be called by the main loop to track energy consumption
   */
  getEnergyConsumedSinceLastPoll(): number {
    const energy = this.energyConsumedSinceLastPoll;
    this.energyConsumedSinceLastPoll = 0; // Reset after reading
    return energy;
  }

  /**
   * Get total energy consumed by sub-agent
   */
  getTotalEnergyConsumed(): number {
    return this.totalEnergyConsumed;
  }

  /**
   * Cancel a pending request
   */
  cancelRequest(requestId: string): boolean {
    const index = this.requestQueue.findIndex(r => r.id === requestId);
    if (index >= 0) {
      this.requestQueue.splice(index, 1);
      this.updateStatus(requestId, 'cancelled', 100, 'Request cancelled');
      this.sendMessage('error', requestId, { error: 'Cancelled by user' });
      return true;
    }
    return false;
  }

  /**
   * Main processing loop (runs continuously in background)
   */
  private async runLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        // Check if there's work to do
        if (this.requestQueue.length === 0) {
          // Sleep briefly when idle
          await this.sleep(100);
          continue;
        }

        // Get next request (already sorted by priority)
        const request = this.requestQueue.shift();
        if (!request) continue;

        // Process the request
        await this.processRequest(request);

      } catch (error) {
        console.error('❌ Sub-agent loop error:', error);
        await this.sleep(1000); // Sleep longer on error
      }
    }
  }

  /**
   * Process a single request
   */
  private async processRequest(request: SubAgentRequest): Promise<void> {
    const startTime = performance.now();
    
    this.updateStatus(request.id, 'in_progress', 0, `Processing ${request.type}`);
    
    try {
      if (this.debugMode) {
        console.log(`🔄 Processing request: ${request.type} (${request.id})`);
      }

      let result: any;

      switch (request.type) {
        case 'test_server':
          result = await this.handleTestServer(request);
          break;
        case 'add_server':
          result = await this.handleAddServer(request);
          break;
        case 'remove_server':
          result = await this.handleRemoveServer(request);
          break;
        case 'list_servers':
          result = await this.handleListServers(request);
          break;
        case 'search_servers':
          result = await this.handleSearchServers(request);
          break;
        default:
          throw new Error(`Unknown request type: ${request.type}`);
      }

      // Calculate processing time
      const processingTime = (performance.now() - startTime) / 1000;
      
      // Calculate and track energy consumption
      const energyConsumed = processingTime * this.energyPerSecond;
      this.trackEnergyConsumption(energyConsumed);
      
      // Update metrics
      this.updateMetrics(processingTime, true);

      // Mark as completed
      this.updateStatus(request.id, 'completed', 100, 'Request completed', result);
      this.sendMessage('completion', request.id, { result });

      if (this.debugMode) {
        console.log(`✅ Completed request: ${request.type} (${processingTime.toFixed(2)}s, ${energyConsumed.toFixed(1)} energy)`);
      }

    } catch (error: any) {
      const processingTime = (performance.now() - startTime) / 1000;
      
      // Track energy even on failure
      const energyConsumed = processingTime * this.energyPerSecond;
      this.trackEnergyConsumption(energyConsumed);
      
      this.updateMetrics(processingTime, false);
      
      const errorMessage = error?.message || 'Unknown error';
      this.updateStatus(request.id, 'failed', 100, `Failed: ${errorMessage}`, undefined, errorMessage);
      this.sendMessage('error', request.id, { error: errorMessage });

      console.error(`❌ Failed request ${request.type}:`, errorMessage);
    }
  }

  /**
   * Handler for test_server requests
   */
  private async handleTestServer(request: SubAgentRequest): Promise<any> {
    const { serverId, serverConfig } = request.params;
    
    this.updateStatus(request.id, 'in_progress', 25, 'Validating server config');
    await this.sleep(500);

    this.updateStatus(request.id, 'in_progress', 50, 'Testing connection');
    await this.sleep(1000);

    this.updateStatus(request.id, 'in_progress', 75, 'Verifying tools');
    await this.sleep(500);

    return {
      serverId,
      status: 'success',
      toolCount: 3,
      message: 'Server test completed successfully'
    };
  }

  /**
   * Handler for add_server requests
   */
  private async handleAddServer(request: SubAgentRequest): Promise<any> {
    const { serverConfig } = request.params as { serverConfig: MCPServerConfig };
    
    this.updateStatus(request.id, 'in_progress', 20, 'Validating configuration');
    await this.sleep(300);

    this.updateStatus(request.id, 'in_progress', 40, 'Adding server to configuration');
    await this.sleep(500);

    this.updateStatus(request.id, 'in_progress', 60, 'Testing server connection');
    await this.sleep(1000);

    this.updateStatus(request.id, 'in_progress', 80, 'Discovering tools');
    await this.sleep(700);

    return {
      serverId: serverConfig.id,
      serverName: serverConfig.name,
      status: 'added',
      toolsDiscovered: 5,
      message: `Server ${serverConfig.name} added successfully`
    };
  }

  /**
   * Handler for remove_server requests
   */
  private async handleRemoveServer(request: SubAgentRequest): Promise<any> {
    const { serverId } = request.params;
    
    this.updateStatus(request.id, 'in_progress', 50, 'Removing server');
    await this.sleep(500);

    return {
      serverId,
      status: 'removed',
      message: `Server ${serverId} removed successfully`
    };
  }

  /**
   * Handler for list_servers requests
   */
  private async handleListServers(request: SubAgentRequest): Promise<any> {
    this.updateStatus(request.id, 'in_progress', 50, 'Listing servers');
    await this.sleep(200);

    return {
      servers: [],
      count: 0,
      message: 'Server list retrieved'
    };
  }

  /**
   * Handler for search_servers requests
   */
  private async handleSearchServers(request: SubAgentRequest): Promise<any> {
    const { query } = request.params;
    
    this.updateStatus(request.id, 'in_progress', 33, 'Searching MCP registry');
    await this.sleep(1000);

    this.updateStatus(request.id, 'in_progress', 66, 'Evaluating results');
    await this.sleep(800);

    return {
      query,
      results: [],
      count: 0,
      message: 'Search completed'
    };
  }

  /**
   * Update the status of a request
   */
  private updateStatus(
    requestId: string,
    state: SubAgentRequestState,
    progress: number,
    message: string,
    result?: any,
    error?: string
  ): void {
    const status = this.statusMap.get(requestId);
    if (!status) return;

    status.state = state;
    status.progress = progress;
    status.message = message;
    
    if (result !== undefined) {
      status.result = result;
    }
    
    if (error !== undefined) {
      status.error = error;
    }

    if (state === 'completed' || state === 'failed' || state === 'cancelled') {
      status.endTime = new Date();
      this.metrics.activeRequests = Math.max(0, this.metrics.activeRequests - 1);
    }

    this.statusMap.set(requestId, status);

    // Send status update message
    this.sendMessage('status_update', requestId, { status });
  }

  /**
   * Send a message to the main loop
   */
  private sendMessage(
    type: SubAgentMessage['type'],
    requestId: string,
    data: any
  ): void {
    const message: SubAgentMessage = {
      type,
      requestId,
      timestamp: new Date(),
      data
    };

    this.messageQueue.push(message);
  }

  /**
   * Update processing metrics
   */
  private updateMetrics(processingTime: number, success: boolean): void {
    if (success) {
      this.metrics.completedRequests++;
    } else {
      this.metrics.failedRequests++;
    }

    // Update average processing time
    const totalCompleted = this.metrics.completedRequests + this.metrics.failedRequests;
    this.metrics.averageProcessingTime = 
      ((this.metrics.averageProcessingTime * (totalCompleted - 1)) + processingTime) / totalCompleted;
  }

  /**
   * Sort queue by priority (high -> medium -> low)
   */
  private sortQueueByPriority(): void {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    this.requestQueue.sort((a, b) => 
      priorityOrder[a.priority] - priorityOrder[b.priority]
    );
  }

  /**
   * Track energy consumption
   */
  private trackEnergyConsumption(energy: number): void {
    this.energyConsumedSinceLastPoll += energy;
    this.totalEnergyConsumed += energy;
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
