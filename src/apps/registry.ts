import Database from 'better-sqlite3';
import { AppEnergyTracker } from './energy-tracker';
import { App, AppConfig, AppMessage, AppEnergyMetrics, AppStatus } from './types';

export class AppRegistry {
  private apps: Map<string, App> = new Map();
  private energyTracker: AppEnergyTracker;
  
  private insertAppStmt!: Database.Statement;
  private updateAppStmt!: Database.Statement;
  private getAppStmt!: Database.Statement;
  private getAllAppsStmt!: Database.Statement;
  private deleteAppStmt!: Database.Statement;
  private associateConversationStmt!: Database.Statement;
  
  constructor(private db: Database.Database) {
    this.initializeSchema();
    this.energyTracker = new AppEnergyTracker(db);
    this.prepareStatements();
  }
  
  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS apps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        app_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL,
        version TEXT,
        config TEXT,
        enabled BOOLEAN DEFAULT TRUE,
        installed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_active_at DATETIME,
        endpoint TEXT,
        hourly_energy_budget REAL,
        daily_energy_budget REAL,
        metadata TEXT
      );
      
      CREATE TABLE IF NOT EXISTS app_energy (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        app_id TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        energy_consumed REAL NOT NULL,
        conversation_id TEXT,
        operation TEXT,
        FOREIGN KEY (app_id) REFERENCES apps(app_id)
      );
      
      CREATE TABLE IF NOT EXISTS app_conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT NOT NULL,
        app_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES conversations(request_id),
        FOREIGN KEY (app_id) REFERENCES apps(app_id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_apps_app_id ON apps(app_id);
      CREATE INDEX IF NOT EXISTS idx_apps_enabled ON apps(enabled);
      CREATE INDEX IF NOT EXISTS idx_app_energy_app_id ON app_energy(app_id);
      CREATE INDEX IF NOT EXISTS idx_app_energy_timestamp ON app_energy(timestamp);
      CREATE INDEX IF NOT EXISTS idx_app_energy_conversation ON app_energy(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_app_conv_conversation ON app_conversations(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_app_conv_app ON app_conversations(app_id);
    `);
    
    try {
      this.db.exec(`ALTER TABLE conversations ADD COLUMN app_id TEXT`);
    } catch (error) {
    }
    
    try {
      this.db.exec(`ALTER TABLE conversations ADD COLUMN app_metadata TEXT`);
    } catch (error) {
    }
  }
  
  private prepareStatements(): void {
    this.insertAppStmt = this.db.prepare(`
      INSERT INTO apps (app_id, name, description, type, version, config, enabled, endpoint, hourly_energy_budget, daily_energy_budget, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    this.updateAppStmt = this.db.prepare(`
      UPDATE apps
      SET name = ?, description = ?, config = ?, enabled = ?, endpoint = ?, hourly_energy_budget = ?, daily_energy_budget = ?, metadata = ?, last_active_at = datetime('now')
      WHERE app_id = ?
    `);
    
    this.getAppStmt = this.db.prepare(`
      SELECT * FROM apps WHERE app_id = ?
    `);
    
    this.getAllAppsStmt = this.db.prepare(`
      SELECT * FROM apps
    `);
    
    this.deleteAppStmt = this.db.prepare(`
      DELETE FROM apps WHERE app_id = ?
    `);
    
    this.associateConversationStmt = this.db.prepare(`
      INSERT OR IGNORE INTO app_conversations (conversation_id, app_id)
      VALUES (?, ?)
    `);
  }
  
  async install(config: AppConfig): Promise<void> {
    this.validateConfig(config);
    
    const existingApp = this.getAppStmt.get(config.id);
    if (existingApp) {
      throw new Error(`App ${config.id} is already installed`);
    }
    
    this.insertAppStmt.run(
      config.id,
      config.name,
      config.description || null,
      config.type,
      config.version || null,
      config.config ? JSON.stringify(config.config) : null,
      config.enabled ? 1 : 0,
      config.endpoint || null,
      config.hourlyEnergyBudget || null,
      config.dailyEnergyBudget || null,
      config.metadata ? JSON.stringify(config.metadata) : null
    );
    
    console.log(`📦 Installed app: ${config.name} (${config.id})`);
  }
  
  async uninstall(appId: string): Promise<void> {
    const app = this.apps.get(appId);
    if (app) {
      await app.stop();
      await app.uninstall();
      this.apps.delete(appId);
    }
    
    this.deleteAppStmt.run(appId);
    
    console.log(`🗑️  Uninstalled app: ${appId}`);
  }
  
  async start(appId: string): Promise<void> {
    const app = this.apps.get(appId);
    if (!app) {
      throw new Error(`App ${appId} not found in registry`);
    }
    
    await app.start();
    
    this.db.prepare(`UPDATE apps SET last_active_at = datetime('now') WHERE app_id = ?`).run(appId);
    
    console.log(`▶️  Started app: ${appId}`);
  }
  
  async stop(appId: string): Promise<void> {
    const app = this.apps.get(appId);
    if (!app) {
      throw new Error(`App ${appId} not found in registry`);
    }
    
    await app.stop();
    
    console.log(`⏸️  Stopped app: ${appId}`);
  }
  
  registerApp(app: App): void {
    this.apps.set(app.id, app);
  }
  
  async routeMessage(message: AppMessage): Promise<void> {
    if (message.to === 'loop') {
      throw new Error('Cannot route message to loop from registry - use loop.handleAppMessage()');
    }
    
    const targetApp = this.apps.get(message.to);
    if (!targetApp) {
      throw new Error(`Target app ${message.to} not found`);
    }
    
    this.associateConversation(message.conversationId, message.to);
    
    await targetApp.receiveMessage(message);
  }
  
  associateConversation(conversationId: string, appId: string): void {
    try {
      this.associateConversationStmt.run(conversationId, appId);
    } catch (error) {
      console.error(`Error associating conversation ${conversationId} with app ${appId}:`, error);
    }
  }
  
  recordEnergy(appId: string, amount: number, conversationId?: string, operation?: string): void {
    this.energyTracker.record(appId, amount, conversationId, operation);
  }
  
  getEnergyMetrics(appId: string): AppEnergyMetrics {
    return this.energyTracker.getMetrics(appId);
  }
  
  getApp(appId: string): App | undefined {
    return this.apps.get(appId);
  }
  
  getAllApps(): App[] {
    return Array.from(this.apps.values());
  }
  
  getAppConfig(appId: string): AppConfig | null {
    const row = this.getAppStmt.get(appId) as any;
    if (!row) return null;
    
    return {
      id: row.app_id,
      name: row.name,
      description: row.description,
      type: row.type,
      version: row.version,
      config: row.config ? JSON.parse(row.config) : undefined,
      enabled: Boolean(row.enabled),
      endpoint: row.endpoint,
      hourlyEnergyBudget: row.hourly_energy_budget,
      dailyEnergyBudget: row.daily_energy_budget,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    };
  }
  
  getAllAppConfigs(): AppConfig[] {
    const rows = this.getAllAppsStmt.all() as any[];
    return rows.map(row => ({
      id: row.app_id,
      name: row.name,
      description: row.description,
      type: row.type,
      version: row.version,
      config: row.config ? JSON.parse(row.config) : undefined,
      enabled: Boolean(row.enabled),
      endpoint: row.endpoint,
      hourlyEnergyBudget: row.hourly_energy_budget,
      dailyEnergyBudget: row.daily_energy_budget,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    }));
  }
  
  getActiveConversations(): Array<{ conversationId: string; appId: string }> {
    try {
      const stmt = this.db.prepare(`
        SELECT DISTINCT conversation_id, app_id
        FROM app_conversations
        ORDER BY created_at DESC
        LIMIT 100
      `);
      const rows = stmt.all() as Array<{ conversation_id: string; app_id: string }>;
      return rows.map(row => ({
        conversationId: row.conversation_id,
        appId: row.app_id
      }));
    } catch (error) {
      console.error('Error getting active conversations:', error);
      return [];
    }
  }
  
  private validateConfig(config: AppConfig): void {
    if (!config.id || typeof config.id !== 'string') {
      throw new Error('App config must have a valid id');
    }
    
    if (!config.name || typeof config.name !== 'string') {
      throw new Error('App config must have a valid name');
    }
    
    if (!['in-process', 'http', 'mcp'].includes(config.type)) {
      throw new Error('App type must be one of: in-process, http, mcp');
    }
    
    if (config.type === 'http' && !config.endpoint) {
      throw new Error('HTTP apps must have an endpoint');
    }
  }
  
  getDatabase(): Database.Database {
    return this.db;
  }
}
