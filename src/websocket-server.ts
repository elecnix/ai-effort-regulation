import { WebSocket, WebSocketServer as WSServer } from 'ws';
import { IncomingMessage } from 'http';
import { v4 as uuidv4 } from 'uuid';

export interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: string;
  id?: string;
}

interface ClientInfo {
  id: string;
  ws: WebSocket;
  connectedAt: Date;
}

export class WebSocketServer {
  private wss: WSServer;
  private clients: Map<string, ClientInfo> = new Map();
  private messageHandlers: Map<string, (clientId: string, payload: any) => void> = new Map();

  constructor(wss: WSServer) {
    this.wss = wss;
    this.setupServer();
  }

  private setupServer(): void {
    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      const clientId = uuidv4();
      const clientInfo: ClientInfo = {
        id: clientId,
        ws,
        connectedAt: new Date()
      };

      this.clients.set(clientId, clientInfo);
      console.log(`🔌 WebSocket client connected: ${clientId} (total: ${this.clients.size})`);

      this.sendToClient(clientId, {
        type: 'connected',
        payload: {
          clientId,
          serverTime: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      });

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString()) as WebSocketMessage;
          this.handleClientMessage(clientId, message);
        } catch (error) {
          console.error(`Error parsing WebSocket message from ${clientId}:`, error);
          this.sendToClient(clientId, {
            type: 'error',
            payload: {
              message: 'Invalid message format',
              code: 'PARSE_ERROR'
            },
            timestamp: new Date().toISOString()
          });
        }
      });

      ws.on('close', () => {
        this.clients.delete(clientId);
        console.log(`🔌 WebSocket client disconnected: ${clientId} (total: ${this.clients.size})`);
      });

      ws.on('error', (error) => {
        console.error(`WebSocket error for client ${clientId}:`, error);
      });

      ws.on('pong', () => {
      });
    });

    setInterval(() => {
      this.clients.forEach((client) => {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.ping();
        }
      });
    }, 30000);
  }

  private handleClientMessage(clientId: string, message: WebSocketMessage): void {
    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      try {
        handler(clientId, message.payload);
      } catch (error) {
        console.error(`Error handling message type ${message.type}:`, error);
        this.sendToClient(clientId, {
          type: 'error',
          payload: {
            message: 'Error processing message',
            code: 'HANDLER_ERROR',
            details: error instanceof Error ? error.message : String(error)
          },
          timestamp: new Date().toISOString()
        });
      }
    } else {
      console.warn(`Unknown message type: ${message.type}`);
      this.sendToClient(clientId, {
        type: 'error',
        payload: {
          message: `Unknown message type: ${message.type}`,
          code: 'UNKNOWN_TYPE'
        },
        timestamp: new Date().toISOString()
      });
    }
  }

  public registerHandler(type: string, handler: (clientId: string, payload: any) => void): void {
    this.messageHandlers.set(type, handler);
  }

  public sendToClient(clientId: string, message: WebSocketMessage): void {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error(`Error sending message to client ${clientId}:`, error);
      }
    }
  }

  public broadcast(message: WebSocketMessage): void {
    const messageStr = JSON.stringify(message);
    let sentCount = 0;

    this.clients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(messageStr);
          sentCount++;
        } catch (error) {
          console.error(`Error broadcasting to client ${client.id}:`, error);
        }
      }
    });

    if (sentCount > 0 && process.env.DEBUG_WS) {
      console.log(`📡 Broadcast ${message.type} to ${sentCount} client(s)`);
    }
  }

  public getClientCount(): number {
    return this.clients.size;
  }

  public close(): void {
    this.clients.forEach((client) => {
      client.ws.close();
    });
    this.wss.close();
  }
}
