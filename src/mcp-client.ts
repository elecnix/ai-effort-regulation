import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn, ChildProcess } from 'child_process';
import { MCPServerConfig } from './mcp-subagent-types';
import { HTTPTransport, Transport } from './mcp-http-transport';

export interface MCPTool {
  name: string; // Namespaced name: serverId_toolName
  originalName?: string; // Original tool name without prefix
  description: string;
  serverId: string;
  serverName: string;
  inputSchema: any;
}

export interface ServerConnection {
  config: MCPServerConfig;
  client?: Client; // For STDIO transport
  transport: StdioClientTransport | HTTPTransport;
  process?: ChildProcess; // Only for STDIO
  tools: MCPTool[];
  connected: boolean;
  lastPing?: Date;
}

/**
 * Manages connections to MCP servers
 */
export class MCPClientManager {
  private connections: Map<string, ServerConnection> = new Map();

  async connectToServer(config: MCPServerConfig): Promise<ServerConnection> {
    try {
      if (config.transport === 'stdio') {
        return await this.connectStdioServer(config);
      } else if (config.transport === 'http') {
        return await this.connectHttpServer(config);
      } else {
        throw new Error(`Unsupported transport type: ${config.transport}`);
      }
    } catch (error) {
      throw new Error(`Failed to connect to server ${config.id}: ${error}`);
    }
  }

  private async connectStdioServer(config: MCPServerConfig): Promise<ServerConnection> {
    if (!config.command || !config.args) {
      throw new Error('STDIO transport requires command and args');
    }

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
      name: `${config.id}_${tool.name}`,
      originalName: tool.name,
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
      connected: true,
      lastPing: new Date()
    };

    this.connections.set(config.id, connection);
    return connection;
  }

  private async connectHttpServer(config: MCPServerConfig): Promise<ServerConnection> {
    if (!config.url) {
      throw new Error('HTTP transport requires url');
    }

    // Expand environment variables in auth
    const processedConfig = this.processConfig(config);

    // Create HTTP transport
    const transport = new HTTPTransport({
      url: processedConfig.url!,
      ...(processedConfig.headers && { headers: processedConfig.headers }),
      ...(processedConfig.timeout && { timeout: processedConfig.timeout }),
      ...(processedConfig.retries && { retries: processedConfig.retries }),
      ...(processedConfig.auth && { auth: processedConfig.auth })
    });

    // Initialize connection
    await transport.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'ai-effort-regulation',
        version: '1.0.0'
      }
    });

    // List available tools
    const toolsResult = await transport.request('tools/list', {});
    const tools: MCPTool[] = (toolsResult.tools || []).map((tool: any) => ({
      name: `${config.id}_${tool.name}`,
      originalName: tool.name,
      description: tool.description || '',
      serverId: config.id,
      serverName: config.name,
      inputSchema: tool.inputSchema || {}
    }));

    const connection: ServerConnection = {
      config,
      transport,
      tools,
      connected: true,
      lastPing: new Date()
    };

    this.connections.set(config.id, connection);
    return connection;
  }

  private processConfig(config: MCPServerConfig): MCPServerConfig {
    const processed = { ...config };

    // Expand environment variables
    if (processed.url) {
      processed.url = this.expandEnvVars(processed.url);
    }

    if (processed.auth?.apiKey) {
      processed.auth.apiKey = this.expandEnvVars(processed.auth.apiKey);
    }

    if (processed.auth?.token) {
      processed.auth.token = this.expandEnvVars(processed.auth.token);
    }

    return processed;
  }

  private expandEnvVars(value: string): string {
    return value.replace(/\$\{([^}]+)\}/g, (_, varName) => {
      return process.env[varName] || '';
    });
  }

  async disconnectServer(serverId: string): Promise<void> {
    const connection = this.connections.get(serverId);
    if (!connection) {
      return;
    }

    try {
      if (connection.client) {
        await connection.client.close();
      }
      if (connection.transport) {
        await connection.transport.close();
      }
      if (connection.process) {
        connection.process.kill();
      }
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
      if (connection.client) {
        // STDIO transport
        await connection.client.listTools();
      } else if (connection.transport instanceof HTTPTransport) {
        // HTTP transport
        await connection.transport.request('tools/list', {});
      }
      connection.lastPing = new Date();
      return true;
    } catch (error) {
      console.error(`Connection test failed for ${serverId}:`, error);
      connection.connected = false;
      return false;
    }
  }

  async callTool(serverId: string, toolName: string, args: any): Promise<any> {
    const connection = this.connections.get(serverId);
    if (!connection || !connection.connected) {
      throw new Error(`Server ${serverId} not connected`);
    }

    // Find the tool to get its original name
    const tool = connection.tools.find(t => t.name === toolName);
    if (!tool) {
      throw new Error(`Tool ${toolName} not found on server ${serverId}`);
    }

    // Use original name for the actual tool call
    const actualToolName = tool.originalName || toolName;

    try {
      if (connection.client) {
        // STDIO transport
        const result = await connection.client.callTool({
          name: actualToolName,
          arguments: args
        });
        return result;
      } else if (connection.transport instanceof HTTPTransport) {
        // HTTP transport
        const result = await connection.transport.request('tools/call', {
          name: actualToolName,
          arguments: args
        });
        return result;
      } else {
        throw new Error(`Unknown transport type for server ${serverId}`);
      }
    } catch (error: any) {
      throw new Error(`Tool call failed for ${toolName} on ${serverId}: ${error.message}`);
    }
  }
}
