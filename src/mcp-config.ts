import * as fs from 'fs';
import * as path from 'path';
import { MCPServerConfig } from './mcp-subagent-types';

export interface MCPConfiguration {
  servers: MCPServerConfig[];
  subAgentEnabled: boolean;
  autoDiscoveryEnabled: boolean;
  toolApprovalRequired: boolean;
}

/**
 * Manages MCP server configuration
 */
export class MCPConfigManager {
  private configPath: string;
  private config: MCPConfiguration | null = null;

  constructor(configPath?: string) {
    this.configPath = configPath || 
      process.env.MCP_CONFIG_PATH || 
      path.join(process.cwd(), 'mcp-servers.json');
  }

  loadConfig(): MCPConfiguration {
    try {
      if (fs.existsSync(this.configPath)) {
        const content = fs.readFileSync(this.configPath, 'utf-8');
        this.config = JSON.parse(content);
        this.validateConfig(this.config!);
        return this.config!;
      } else {
        this.config = this.getDefaultConfig();
        this.saveConfig(this.config);
        return this.config;
      }
    } catch (error) {
      console.error('Error loading MCP config:', error);
      throw new Error(`Failed to load MCP configuration: ${error}`);
    }
  }

  saveConfig(config: MCPConfiguration): void {
    try {
      this.validateConfig(config);
      const content = JSON.stringify(config, null, 2);
      fs.writeFileSync(this.configPath, content, 'utf-8');
      this.config = config;
    } catch (error) {
      console.error('Error saving MCP config:', error);
      throw new Error(`Failed to save MCP configuration: ${error}`);
    }
  }

  addServer(server: MCPServerConfig): void {
    const config = this.config || this.loadConfig();
    const existingIndex = config.servers.findIndex(s => s.id === server.id);
    if (existingIndex >= 0) {
      config.servers[existingIndex] = server;
    } else {
      config.servers.push(server);
    }
    this.saveConfig(config);
  }

  removeServer(serverId: string): boolean {
    const config = this.config || this.loadConfig();
    const initialLength = config.servers.length;
    config.servers = config.servers.filter(s => s.id !== serverId);
    if (config.servers.length < initialLength) {
      this.saveConfig(config);
      return true;
    }
    return false;
  }

  getServer(serverId: string): MCPServerConfig | undefined {
    const config = this.config || this.loadConfig();
    return config.servers.find(s => s.id === serverId);
  }

  listServers(): MCPServerConfig[] {
    const config = this.config || this.loadConfig();
    return [...config.servers];
  }

  private validateConfig(config: MCPConfiguration): void {
    if (!config.servers || !Array.isArray(config.servers)) {
      throw new Error('Invalid configuration: servers must be an array');
    }
    for (const server of config.servers) {
      if (!server.id || !server.name || !server.command || !Array.isArray(server.args)) {
        throw new Error(`Invalid server configuration: ${JSON.stringify(server)}`);
      }
    }
  }

  private getDefaultConfig(): MCPConfiguration {
    return {
      servers: [],
      subAgentEnabled: true,
      autoDiscoveryEnabled: false,
      toolApprovalRequired: false
    };
  }
}
