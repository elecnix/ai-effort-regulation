# Monitor UI - Technical Specification

## 1. System Architecture

### 1.1 Component Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser (Client)                        │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              React Application                         │ │
│  │  ┌──────────┬──────────┬──────────┬──────────────────┐│ │
│  │  │  Chat    │  Event   │  Convo   │  System Health   ││ │
│  │  │  Panel   │  Stream  │  List    │  Dashboard       ││ │
│  │  └──────────┴──────────┴──────────┴──────────────────┘│ │
│  │  ┌────────────────────────────────────────────────────┐│ │
│  │  │         WebSocket Client Manager                   ││ │
│  │  └────────────────────────────────────────────────────┘│ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ WebSocket (ws://)
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   Node.js Server                            │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Express HTTP Server                       │ │
│  │  - Serves static React build                           │ │
│  │  - Existing REST API endpoints                         │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              WebSocket Server (ws)                     │ │
│  │  - Client connection management                        │ │
│  │  - Message routing                                     │ │
│  │  - Event broadcasting                                  │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Event Emitter Bridge                      │ │
│  │  - Hooks into SensitiveLoop events                     │ │
│  │  - Broadcasts to WebSocket clients                     │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   Sensitive Loop                            │
│  - Energy Regulator                                         │
│  - Inbox (Conversation Manager)                             │
│  - Intelligent Model                                        │
│  - MCP Sub-Agent                                            │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Technology Stack

**Frontend**
- React 18.2+ with TypeScript
- Vite for build tooling
- TailwindCSS 3.x for styling
- shadcn/ui for UI components
- Lucide React for icons
- WebSocket API (native browser)

**Backend**
- ws (WebSocket library) ^8.x
- Express (existing) ^4.x
- TypeScript (existing)

**Build Integration**
- Single `npm start` command
- Concurrent build: backend + frontend
- Frontend served from Express static middleware

## 2. WebSocket Protocol Specification

### 2.1 Connection

**Endpoint**: `ws://localhost:{PORT}/ws`

**Connection Flow**:
1. Client connects to WebSocket endpoint
2. Server sends `connected` event with client ID
3. Client sends `subscribe_all` to receive broadcasts
4. Server begins sending event broadcasts

**Reconnection**:
- Client automatically reconnects on disconnect
- Exponential backoff: 1s, 2s, 4s, 8s, max 30s
- Client re-subscribes on reconnection

### 2.2 Message Format

All messages are JSON with this structure:

```typescript
interface WebSocketMessage {
  type: string;           // Message type
  payload: any;           // Type-specific payload
  timestamp: string;      // ISO 8601 timestamp
  id?: string;            // Optional message ID
}
```

### 2.3 Client → Server Messages

#### 2.3.1 Send Message
```typescript
{
  type: 'send_message',
  payload: {
    content: string;
    energyBudget?: number;
  }
}
```

#### 2.3.2 Subscribe to All Events
```typescript
{
  type: 'subscribe_all'
}
```

#### 2.3.3 Get Conversations
```typescript
{
  type: 'get_conversations',
  payload: {
    limit?: number;  // Default: 50
  }
}
```

#### 2.3.4 Get Conversation Detail
```typescript
{
  type: 'get_conversation',
  payload: {
    conversationId: string;
  }
}
```

#### 2.3.5 Get System Stats
```typescript
{
  type: 'get_stats'
}
```

### 2.4 Server → Client Messages (Broadcasts)

#### 2.4.1 Connection Established
```typescript
{
  type: 'connected',
  payload: {
    clientId: string;
    serverTime: string;
  }
}
```

#### 2.4.2 Energy Update
```typescript
{
  type: 'energy_update',
  payload: {
    current: number;        // Current energy level
    max: number;            // Maximum energy
    min: number;            // Minimum energy
    percentage: number;     // 0-100
    status: string;         // 'normal' | 'low' | 'critical' | 'urgent'
    delta: number;          // Change since last update
  }
}
```

#### 2.4.3 Conversation Created
```typescript
{
  type: 'conversation_created',
  payload: {
    conversationId: string;
    userMessage: string;
    energyBudget: number | null;
    timestamp: string;
  }
}
```

#### 2.4.4 Message Added
```typescript
{
  type: 'message_added',
  payload: {
    conversationId: string;
    role: 'user' | 'assistant';
    content: string;
    energyLevel: number;
    modelUsed: string;
    timestamp: string;
  }
}
```

#### 2.4.5 Conversation State Changed
```typescript
{
  type: 'conversation_state_changed',
  payload: {
    conversationId: string;
    oldState: 'active' | 'snoozed' | 'ended';
    newState: 'active' | 'snoozed' | 'ended';
    reason?: string;
    snoozeUntil?: string;  // ISO timestamp if snoozed
  }
}
```

#### 2.4.6 Model Switched
```typescript
{
  type: 'model_switched',
  payload: {
    from: string;
    to: string;
    reason: string;
    energyLevel: number;
  }
}
```

#### 2.4.7 Sleep Cycle
```typescript
{
  type: 'sleep_start',
  payload: {
    reason: string;
    energyLevel: number;
    expectedDuration: number;  // milliseconds
  }
}

{
  type: 'sleep_end',
  payload: {
    duration: number;          // actual duration in ms
    energyRestored: number;
    newEnergyLevel: number;
  }
}
```

#### 2.4.8 Tool Invocation
```typescript
{
  type: 'tool_invocation',
  payload: {
    conversationId: string;
    toolName: string;
    arguments: any;
    result?: any;
    error?: string;
    duration: number;  // milliseconds
  }
}
```

#### 2.4.9 System Stats
```typescript
{
  type: 'system_stats',
  payload: {
    totalConversations: number;
    activeConversations: number;
    snoozedConversations: number;
    totalResponses: number;
    avgEnergyLevel: number;
    currentEnergy: number;
    modelSwitches: number;
    sleepCycles: number;
    uptime: number;  // seconds
  }
}
```

#### 2.4.10 Conversations List
```typescript
{
  type: 'conversations_list',
  payload: {
    conversations: Array<{
      id: string;
      userMessage: string;
      state: string;
      messageCount: number;
      energyConsumed: number;
      lastActivity: string;
    }>;
  }
}
```

#### 2.4.11 Conversation Detail
```typescript
{
  type: 'conversation_detail',
  payload: {
    requestId: string;
    inputMessage: string;
    responses: Array<{
      timestamp: string;
      content: string;
      energyLevel: number;
      modelUsed: string;
    }>;
    metadata: {
      totalEnergyConsumed: number;
      sleepCycles: number;
      modelSwitches: number;
      energyBudget: number | null;
      energyBudgetRemaining: number | null;
      budgetStatus: string | null;
    };
  }
}
```

#### 2.4.12 Error
```typescript
{
  type: 'error',
  payload: {
    message: string;
    code?: string;
    details?: any;
  }
}
```

## 3. Frontend Specification

### 3.1 Application Structure

```
ui/
├── src/
│   ├── components/
│   │   ├── ChatPanel.tsx           # Main chat interface
│   │   ├── ConversationList.tsx    # List of conversations
│   │   ├── EventStream.tsx         # Live event feed
│   │   ├── SystemHealth.tsx        # Health dashboard
│   │   ├── EnergyGauge.tsx         # Energy level indicator
│   │   ├── MessageBubble.tsx       # Individual message
│   │   └── ui/                     # shadcn/ui components
│   ├── hooks/
│   │   ├── useWebSocket.ts         # WebSocket connection
│   │   ├── useConversations.ts     # Conversation state
│   │   └── useSystemStats.ts       # System statistics
│   ├── types/
│   │   ├── websocket.ts            # WebSocket message types
│   │   └── conversation.ts         # Conversation types
│   ├── utils/
│   │   ├── websocket.ts            # WebSocket utilities
│   │   └── formatting.ts           # Display formatting
│   ├── App.tsx                     # Main application
│   ├── main.tsx                    # Entry point
│   └── index.css                   # Global styles
├── public/
│   └── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

### 3.2 Key Components

#### 3.2.1 App.tsx
Main application layout with 4-panel design:
- Left: Conversation list
- Center: Chat panel
- Right: Event stream
- Top: System health bar

#### 3.2.2 ChatPanel.tsx
- Message history display
- Input field with energy budget option
- Send button
- Auto-scroll to latest message
- Loading indicators

#### 3.2.3 ConversationList.tsx
- Scrollable list of conversations
- Click to switch active conversation
- Visual indicators for state (active/snoozed/ended)
- Energy consumption badge
- Search/filter capability

#### 3.2.4 EventStream.tsx
- Real-time event feed
- Color-coded by event type
- Collapsible event details
- Auto-scroll with pause option
- Event type filters

#### 3.2.5 SystemHealth.tsx
- Energy gauge (circular or linear)
- Active conversation count
- Current model indicator
- Uptime display
- Quick stats

#### 3.2.6 EnergyGauge.tsx
- Visual representation of energy level
- Color coding: green (>50), yellow (20-50), red (<20)
- Animated transitions
- Percentage display

### 3.3 State Management

**React Context for Global State**:
- WebSocket connection state
- Current conversation ID
- Conversations map
- System stats
- Event history (last 100 events)

**Local Component State**:
- UI interactions
- Form inputs
- Scroll positions

### 3.4 Styling

**TailwindCSS Configuration**:
- Dark mode by default
- Custom color palette for energy levels
- Responsive breakpoints
- Animation utilities

**Component Library**:
- shadcn/ui for consistent components
- Custom theme matching system aesthetic

## 4. Backend Specification

### 4.1 WebSocket Server Implementation

**File**: `src/websocket-server.ts`

```typescript
class WebSocketServer {
  private wss: WebSocket.Server;
  private clients: Map<string, WebSocket>;
  
  constructor(server: http.Server);
  
  // Client management
  handleConnection(ws: WebSocket): void;
  handleDisconnection(clientId: string): void;
  
  // Message handling
  handleMessage(clientId: string, message: WebSocketMessage): void;
  
  // Broadcasting
  broadcast(message: WebSocketMessage): void;
  broadcastToClient(clientId: string, message: WebSocketMessage): void;
  
  // Event hooks
  onEnergyUpdate(energy: number, delta: number): void;
  onConversationCreated(conversation: any): void;
  onMessageAdded(conversationId: string, message: any): void;
  onConversationStateChanged(conversationId: string, oldState: string, newState: string): void;
  onModelSwitched(from: string, to: string, reason: string): void;
  onSleepStart(reason: string, energy: number): void;
  onSleepEnd(duration: number, energyRestored: number): void;
  onToolInvocation(tool: any): void;
}
```

### 4.2 Event Emitter Integration

**File**: `src/event-bridge.ts`

Hooks into existing system components to emit events:

```typescript
class EventBridge {
  private wsServer: WebSocketServer;
  private sensitiveLoop: SensitiveLoop;
  
  constructor(wsServer: WebSocketServer, sensitiveLoop: SensitiveLoop);
  
  // Attach listeners to system components
  attachEnergyListeners(): void;
  attachConversationListeners(): void;
  attachModelListeners(): void;
  attachToolListeners(): void;
  
  // Periodic stats broadcasting
  startStatsInterval(intervalMs: number): void;
}
```

### 4.3 Server Integration

**Modifications to `src/server.ts`**:

1. Add WebSocket server initialization
2. Serve static React build from `/ui/dist`
3. Add WebSocket upgrade handling
4. Integrate with existing Express app

**Modifications to `src/index.ts`**:

1. Initialize WebSocket server after HTTP server
2. Create EventBridge to connect components
3. No changes to existing startup flow

### 4.4 Static File Serving

```typescript
// In server.ts
app.use(express.static(path.join(__dirname, '../../ui/dist')));

// Catch-all route for React Router
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api') && !req.path.startsWith('/conversations')) {
    res.sendFile(path.join(__dirname, '../../ui/dist/index.html'));
  }
});
```

## 5. Build System Integration

### 5.1 Package.json Scripts

```json
{
  "scripts": {
    "build": "npm run build:backend && npm run build:frontend",
    "build:backend": "tsc",
    "build:frontend": "cd ui && npm run build",
    "start": "npm run build && node dist/src/index.js",
    "dev": "concurrently \"npm run dev:backend\" \"npm run dev:frontend\"",
    "dev:backend": "tsc --watch",
    "dev:frontend": "cd ui && npm run dev",
    "install:all": "npm install && cd ui && npm install"
  }
}
```

### 5.2 Frontend Build Output

- Vite builds to `ui/dist/`
- Backend serves from `dist/src/../../ui/dist`
- Production-ready minified bundle

## 6. Data Flow Examples

### 6.1 User Sends Message

1. User types message in ChatPanel
2. ChatPanel calls `sendMessage()` from useWebSocket hook
3. WebSocket sends `send_message` to server
4. Server creates conversation via existing `/message` endpoint
5. SensitiveLoop processes message
6. EventBridge broadcasts `conversation_created` event
7. EventBridge broadcasts `message_added` events as AI responds
8. All connected clients receive updates
9. ChatPanel updates to show new messages

### 6.2 Energy Level Changes

1. EnergyRegulator updates energy level
2. EventBridge detects change via listener
3. EventBridge broadcasts `energy_update` event
4. All clients receive update
5. EnergyGauge component animates to new value
6. SystemHealth updates percentage display

### 6.3 Model Switch

1. IntelligentModel decides to switch models
2. EventBridge detects switch via listener
3. EventBridge broadcasts `model_switched` event
4. EventStream shows model switch event
5. SystemHealth updates current model display

## 7. Error Handling

### 7.1 WebSocket Errors

- Connection failures: Auto-reconnect with backoff
- Message parsing errors: Log and ignore
- Server errors: Display error notification

### 7.2 API Errors

- Failed message send: Show error in chat
- Failed conversation load: Show error state
- Network timeout: Retry with exponential backoff

### 7.3 UI Errors

- React error boundaries for component crashes
- Graceful degradation for missing data
- User-friendly error messages

## 8. Performance Considerations

### 8.1 Event Throttling

- Energy updates: Max 10/second
- Stats updates: Every 2 seconds
- Event stream: Buffer and batch if >100 events/second

### 8.2 Memory Management

- Event history: Keep last 100 events in memory
- Conversation list: Virtualized scrolling for 100+ items
- Message history: Lazy load older messages

### 8.3 WebSocket Optimization

- Binary frames for large payloads
- Compression for text messages
- Heartbeat/ping every 30 seconds

## 9. Security Considerations

### 9.1 WebSocket Security

- Same-origin policy enforcement
- No authentication (development tool)
- Rate limiting on message sending
- Input validation on all client messages

### 9.2 XSS Prevention

- Sanitize all user-generated content
- Use React's built-in XSS protection
- No `dangerouslySetInnerHTML` for user content

## 10. Testing Strategy

### 10.1 Frontend Tests

- Component unit tests (React Testing Library)
- WebSocket mock for integration tests
- E2E tests with Playwright

### 10.2 Backend Tests

- WebSocket server unit tests
- Event broadcasting tests
- Integration tests with SensitiveLoop

### 10.3 Manual Testing

- Multiple browser tabs (multi-client)
- Network disconnection scenarios
- High-frequency event scenarios
- Long-running sessions

## 11. Deployment

### 11.1 Development

```bash
npm run dev
# Backend: http://localhost:6740
# Frontend: http://localhost:5173 (Vite dev server)
# WebSocket: ws://localhost:6740/ws
```

### 11.2 Production

```bash
npm run build
npm start
# All services: http://localhost:6740
# WebSocket: ws://localhost:6740/ws
```

### 11.3 Docker

- Update Dockerfile to include UI build
- Expose port 6740 for both HTTP and WebSocket
- No additional configuration needed

---

**Version**: 1.0  
**Status**: Specification Complete  
**Next Step**: Implementation Plan
