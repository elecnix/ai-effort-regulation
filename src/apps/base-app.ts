import { App, AppConfig, AppMessage, AppStatus, AppEnergyMetrics } from './types';
import { AppRegistry } from './registry';

export abstract class BaseApp implements App {
  protected running: boolean = false;
  
  constructor(
    public id: string,
    public name: string,
    protected registry: AppRegistry
  ) {}
  
  abstract receiveMessage(message: AppMessage): Promise<void>;
  
  async sendMessage(message: AppMessage): Promise<void> {
    await this.registry.routeMessage(message);
  }
  
  reportEnergyConsumption(amount: number, conversationId?: string, operation?: string): void {
    this.registry.recordEnergy(this.id, amount, conversationId, operation);
  }
  
  async install(config: AppConfig): Promise<void> {
    console.log(`📦 Installing ${this.name}...`);
  }
  
  async start(): Promise<void> {
    this.running = true;
    console.log(`▶️  Starting ${this.name}...`);
  }
  
  async stop(): Promise<void> {
    this.running = false;
    console.log(`⏸️  Stopping ${this.name}...`);
  }
  
  async uninstall(): Promise<void> {
    console.log(`🗑️  Uninstalling ${this.name}...`);
  }
  
  async getStatus(): Promise<AppStatus> {
    const energy = this.registry.getEnergyMetrics(this.id);
    const conversations = this.getConversationCounts();
    
    return {
      id: this.id,
      name: this.name,
      enabled: true,
      running: this.running,
      energy,
      conversations,
      health: this.determineHealth(energy)
    };
  }
  
  protected getConversationCounts(): { active: number; total: number } {
    const allConversations = this.registry.getActiveConversations();
    const myConversations = allConversations.filter(c => c.appId === this.id);
    
    return {
      active: myConversations.length,
      total: myConversations.length
    };
  }
  
  protected determineHealth(energy: AppEnergyMetrics): 'healthy' | 'degraded' | 'unhealthy' {
    if (energy.last1min > 50) {
      return 'unhealthy';
    } else if (energy.last1h > 200) {
      return 'degraded';
    }
    return 'healthy';
  }
}
