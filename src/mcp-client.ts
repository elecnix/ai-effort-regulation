import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn, ChildProcess } from 'child_process';
import { MCPServerConfig } from './mcp-subagent-types';

export interface MCPTool {
  name: string;
  description: string;
  serverId: string;
  serverName: string;
  inputSchema: any;
}

export interface ServerConnection {
  config: MCPServerConfig;
  client: Client;
  transport: StdioClientTransport;
  process: ChildProcess;
  tools: MCPTool[];
  connected: boolean;
}

/**
 * Manages connections to MCP servers
 */
export class MCPClientManager {
  private connections: Map<string, ServerConnection> = new Map();

  async connectToServer(config: MCPServerConfig): Promise<ServerConnection> {
    try {
      // Spawn the server process
      const serverProcess = spawn(config.command, config.args, {
        env: { ...process.env, ...config.env },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Create stdio transport
      const transport = new StdioClientTransport({
        command: config.command,
        args: config.args,
        ...(config.env && { env: config.env })
      });

      // Create MCP client
      const client = new Client({
        name: 'ai-effort-regulation',
        version: '1.0.0'
      }, {
        capabilities: {}
      });

      // Connect client to transport
      await client.connect(transport);

      // List available tools
      const toolsResponse = await client.listTools();
      const tools: MCPTool[] = (toolsResponse.tools || []).map((tool: any) => ({
        name: tool.name,
        description: tool.description || '',
        serverId: config.id,
        serverName: config.name,
        inputSchema: tool.inputSchema || {}
      }));

      const connection: ServerConnection = {
        config,
        client,
        transport,
        process: serverProcess,
        tools,
        connected: true
      };

      this.connections.set(config.id, connection);

      return connection;
    } catch (error) {
      throw new Error(`Failed to connect to server ${config.id}: ${error}`);
    }
  }

  async disconnectServer(serverId: string): Promise<void> {
    const connection = this.connections.get(serverId);
    if (!connection) {
      return;
    }

    try {
      await connection.client.close();
      connection.process.kill();
      connection.connected = false;
      this.connections.delete(serverId);
    } catch (error) {
      console.error(`Error disconnecting server ${serverId}:`, error);
    }
  }

  getConnection(serverId: string): ServerConnection | undefined {
    return this.connections.get(serverId);
  }

  getAllConnections(): ServerConnection[] {
    return Array.from(this.connections.values());
  }

  async disconnectAll(): Promise<void> {
    const serverIds = Array.from(this.connections.keys());
    for (const id of serverIds) {
      await this.disconnectServer(id);
    }
  }

  isConnected(serverId: string): boolean {
    const connection = this.connections.get(serverId);
    return connection?.connected || false;
  }

  async testConnection(serverId: string): Promise<boolean> {
    const connection = this.connections.get(serverId);
    if (!connection || !connection.connected) {
      return false;
    }

    try {
      // Try to list tools as a health check
      await connection.client.listTools();
      return true;
    } catch (error) {
      console.error(`Connection test failed for ${serverId}:`, error);
      return false;
    }
  }
}
