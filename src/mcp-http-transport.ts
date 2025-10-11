export interface HTTPTransportConfig {
  url: string;
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  auth?: {
    type: 'none' | 'apikey' | 'bearer';
    apiKey?: string;
    token?: string;
    headerName?: string;
  };
}

export interface Transport {
  request(method: string, params: any): Promise<any>;
  close(): Promise<void>;
}

export class HTTPTransport implements Transport {
  private baseUrl: string;
  private headers: Record<string, string>;
  private timeout: number;
  private retries: number;
  private requestId: number = 0;

  constructor(config: HTTPTransportConfig) {
    this.baseUrl = config.url;
    this.headers = this.buildHeaders(config);
    this.timeout = config.timeout || 30000;
    this.retries = config.retries || 3;
  }

  async request(method: string, params: any): Promise<any> {
    const payload = {
      jsonrpc: '2.0',
      id: ++this.requestId,
      method,
      params
    };

    for (let attempt = 1; attempt <= this.retries; attempt++) {
      try {
        const response = await this.httpRequest(payload);
        return response.result;
      } catch (error: any) {
        if (attempt === this.retries) {
          throw new Error(`HTTP MCP request failed after ${this.retries} attempts: ${error.message}`);
        }
        // Exponential backoff
        await this.delay(Math.pow(2, attempt) * 1000);
      }
    }
  }

  private async httpRequest(payload: any): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.headers
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as any;
      
      if (data.error) {
        throw new Error(`MCP Error [${data.error.code}]: ${data.error.message}`);
      }

      return data;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.timeout}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private buildHeaders(config: HTTPTransportConfig): Record<string, string> {
    const headers: Record<string, string> = {};

    if (config.headers) {
      Object.assign(headers, config.headers);
    }

    if (config.auth) {
      switch (config.auth.type) {
        case 'bearer':
          if (config.auth.token) {
            headers['Authorization'] = `Bearer ${config.auth.token}`;
          }
          break;
        case 'apikey':
          if (config.auth.apiKey) {
            const headerName = config.auth.headerName || 'X-API-Key';
            headers[headerName] = config.auth.apiKey;
          }
          break;
      }
    }

    return headers;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async close(): Promise<void> {
    // No persistent connection to close for HTTP
  }
}
