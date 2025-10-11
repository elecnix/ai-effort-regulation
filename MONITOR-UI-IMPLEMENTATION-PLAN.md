# Monitor UI - Implementation Plan

## Overview

This document outlines the step-by-step implementation plan for the Monitor UI feature. The implementation is designed to be incremental, testable, and non-breaking to existing functionality.

## Implementation Phases

### Phase 1: Backend WebSocket Infrastructure ✅
**Goal**: Add WebSocket server and event broadcasting without breaking existing functionality.

**Tasks**:
1. ✅ Add WebSocket dependencies (`ws`, `@types/ws`)
2. ✅ Create `src/websocket-server.ts` - WebSocket server implementation
3. ✅ Create `src/event-bridge.ts` - Event emitter bridge
4. ✅ Modify `src/server.ts` - Integrate WebSocket server
5. ✅ Modify `src/index.ts` - Initialize event bridge
6. ✅ Test WebSocket connectivity with simple client

**Acceptance Criteria**:
- WebSocket server starts on same port as HTTP server
- Clients can connect and receive `connected` event
- No impact on existing HTTP endpoints
- All existing tests pass

### Phase 2: Event Broadcasting ✅
**Goal**: Hook into system events and broadcast to WebSocket clients.

**Tasks**:
1. ✅ Add event listeners to EnergyRegulator
2. ✅ Add event listeners to Inbox (conversation events)
3. ✅ Add event listeners to IntelligentModel (model switches)
4. ✅ Implement periodic stats broadcasting
5. ✅ Test event flow with WebSocket client

**Acceptance Criteria**:
- Energy updates broadcast on every change
- Conversation events broadcast (created, message added, state changed)
- Model switches broadcast
- Stats broadcast every 2 seconds
- Events include all required payload data

### Phase 3: WebSocket Message Handling ✅
**Goal**: Handle client messages for interaction.

**Tasks**:
1. ✅ Implement `send_message` handler
2. ✅ Implement `get_conversations` handler
3. ✅ Implement `get_conversation` handler
4. ✅ Implement `get_stats` handler
5. ✅ Add error handling and validation
6. ✅ Test all message types

**Acceptance Criteria**:
- Clients can send messages via WebSocket
- Clients can request conversation data
- Clients can request system stats
- Invalid messages return error events
- All handlers tested

### Phase 4: Frontend Setup ✅
**Goal**: Create React application with build system.

**Tasks**:
1. ✅ Create `ui/` directory structure
2. ✅ Initialize Vite + React + TypeScript project
3. ✅ Install dependencies (TailwindCSS, shadcn/ui, Lucide)
4. ✅ Configure TailwindCSS
5. ✅ Set up shadcn/ui
6. ✅ Create basic App.tsx with layout
7. ✅ Test frontend build

**Acceptance Criteria**:
- `npm run build:frontend` produces `ui/dist/`
- Frontend accessible via Vite dev server
- TailwindCSS working
- shadcn/ui components available

### Phase 5: WebSocket Client ✅
**Goal**: Implement WebSocket connection in React.

**Tasks**:
1. ✅ Create `useWebSocket` hook
2. ✅ Implement connection management
3. ✅ Implement auto-reconnect logic
4. ✅ Implement message sending
5. ✅ Implement event listeners
6. ✅ Test connection and reconnection

**Acceptance Criteria**:
- Hook connects to WebSocket on mount
- Auto-reconnects on disconnect
- Exposes `sendMessage` function
- Exposes event subscription
- Handles connection errors gracefully

### Phase 6: Core UI Components ✅
**Goal**: Build main UI components.

**Tasks**:
1. ✅ Create `SystemHealth` component
2. ✅ Create `EnergyGauge` component
3. ✅ Create `ConversationList` component
4. ✅ Create `ChatPanel` component
5. ✅ Create `EventStream` component
6. ✅ Create `MessageBubble` component
7. ✅ Test component rendering

**Acceptance Criteria**:
- All components render without errors
- Components accept required props
- Components styled with TailwindCSS
- Components responsive

### Phase 7: State Management ✅
**Goal**: Implement global state for conversations and events.

**Tasks**:
1. ✅ Create React Context for WebSocket state
2. ✅ Create `useConversations` hook
3. ✅ Create `useSystemStats` hook
4. ✅ Implement event history management
5. ✅ Test state updates from WebSocket events

**Acceptance Criteria**:
- Context provides WebSocket connection
- Conversations state updates from events
- Stats state updates from events
- Event history limited to last 100 events
- State updates trigger re-renders

### Phase 8: Integration & Polish ✅
**Goal**: Connect all components and add finishing touches.

**Tasks**:
1. ✅ Integrate all components in App.tsx
2. ✅ Add conversation switching
3. ✅ Add message sending from ChatPanel
4. ✅ Add event filtering in EventStream
5. ✅ Add loading states
6. ✅ Add error states
7. ✅ Add animations
8. ✅ Test full user flow

**Acceptance Criteria**:
- Can send messages and see responses
- Can switch between conversations
- Can see real-time events
- Can monitor system health
- UI smooth and responsive
- No console errors

### Phase 9: Build Integration ✅
**Goal**: Integrate frontend build into main project.

**Tasks**:
1. ✅ Update root `package.json` with build scripts
2. ✅ Configure Express to serve static files
3. ✅ Add catch-all route for React Router
4. ✅ Test production build
5. ✅ Update `npm start` to build both backend and frontend

**Acceptance Criteria**:
- `npm run build` builds both backend and frontend
- `npm start` serves complete application
- Frontend accessible at `http://localhost:6740/`
- WebSocket connects to same port
- All routes work correctly

### Phase 10: Testing ✅
**Goal**: Comprehensive testing of the Monitor UI.

**Tasks**:
1. ✅ Write WebSocket server tests
2. ✅ Write event bridge tests
3. ✅ Write frontend component tests
4. ✅ Write integration tests
5. ✅ Manual testing scenarios
6. ✅ Performance testing
7. ✅ Update existing tests if needed

**Acceptance Criteria**:
- All new code has test coverage
- All existing tests still pass
- Integration tests cover key flows
- Performance meets requirements (<50ms latency)
- No memory leaks in long-running sessions

### Phase 11: Documentation ✅
**Goal**: Document the Monitor UI for users and developers.

**Tasks**:
1. ✅ Update README.md with Monitor UI section
2. ✅ Update USER-GUIDE.md with Monitor UI usage
3. ✅ Update FEATURES.md with Monitor UI feature
4. ✅ Create MONITOR-UI-GUIDE.md for detailed usage
5. ✅ Add screenshots/GIFs
6. ✅ Update DOCUMENTATION-INDEX.md

**Acceptance Criteria**:
- Users can understand how to access Monitor UI
- Developers can understand architecture
- All features documented
- Examples provided

## Detailed Implementation Steps

### Step 1: Install Dependencies

```bash
# Backend dependencies
npm install ws
npm install --save-dev @types/ws

# Frontend setup
mkdir ui
cd ui
npm create vite@latest . -- --template react-ts
npm install
npm install -D tailwindcss postcss autoprefixer
npm install lucide-react
npx tailwindcss init -p

# shadcn/ui
npx shadcn-ui@latest init
npx shadcn-ui@latest add button
npx shadcn-ui@latest add card
npx shadcn-ui@latest add badge
npx shadcn-ui@latest add scroll-area
npx shadcn-ui@latest add separator
npx shadcn-ui@latest add input
```

### Step 2: Create WebSocket Server

**File**: `src/websocket-server.ts`

Key responsibilities:
- Manage WebSocket connections
- Handle client messages
- Broadcast events to all clients
- Maintain client registry

### Step 3: Create Event Bridge

**File**: `src/event-bridge.ts`

Key responsibilities:
- Listen to SensitiveLoop events
- Transform events to WebSocket messages
- Broadcast to WebSocket server
- Periodic stats updates

### Step 4: Modify Server

**File**: `src/server.ts`

Changes:
- Import WebSocket server
- Initialize WebSocket on HTTP server upgrade
- Serve static files from `ui/dist`
- Add catch-all route for SPA

### Step 5: Create Frontend Structure

```
ui/
├── src/
│   ├── components/
│   │   ├── ChatPanel.tsx
│   │   ├── ConversationList.tsx
│   │   ├── EventStream.tsx
│   │   ├── SystemHealth.tsx
│   │   ├── EnergyGauge.tsx
│   │   ├── MessageBubble.tsx
│   │   └── ui/  (shadcn components)
│   ├── hooks/
│   │   ├── useWebSocket.ts
│   │   ├── useConversations.ts
│   │   └── useSystemStats.ts
│   ├── types/
│   │   ├── websocket.ts
│   │   └── conversation.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

### Step 6: Implement useWebSocket Hook

**File**: `ui/src/hooks/useWebSocket.ts`

Features:
- Auto-connect on mount
- Auto-reconnect with exponential backoff
- Send message function
- Event subscription
- Connection state

### Step 7: Build UI Components

Each component should:
- Use TypeScript for props
- Use TailwindCSS for styling
- Handle loading/error states
- Be responsive
- Use shadcn/ui where appropriate

### Step 8: Integrate Build System

**Root package.json**:
```json
{
  "scripts": {
    "build": "npm run build:backend && npm run build:frontend",
    "build:backend": "tsc",
    "build:frontend": "cd ui && npm run build",
    "start": "npm run build && node dist/src/index.js",
    "dev": "concurrently \"npm run dev:backend\" \"npm run dev:frontend\"",
    "dev:backend": "tsc --watch",
    "dev:frontend": "cd ui && npm run dev"
  }
}
```

## Testing Strategy

### Unit Tests

**Backend**:
- WebSocket server connection handling
- Event bridge event transformation
- Message validation

**Frontend**:
- Component rendering
- Hook behavior
- State management

### Integration Tests

- WebSocket connection flow
- Message sending and receiving
- Event broadcasting
- Conversation switching

### Manual Testing Scenarios

1. **Basic Flow**:
   - Open Monitor UI
   - Send a message
   - See response appear
   - Check energy level updates

2. **Multi-Conversation**:
   - Send multiple messages
   - Switch between conversations
   - Verify state persists

3. **Real-Time Events**:
   - Watch event stream
   - Verify energy updates
   - Verify model switches
   - Verify conversation state changes

4. **Reconnection**:
   - Disconnect network
   - Verify auto-reconnect
   - Verify state recovery

5. **Performance**:
   - Send rapid messages
   - Monitor for lag
   - Check memory usage
   - Verify no memory leaks

## Rollout Plan

### Development

1. Implement Phase 1-3 (Backend)
2. Test with simple WebSocket client
3. Implement Phase 4-8 (Frontend)
4. Test with Vite dev server
5. Implement Phase 9 (Integration)
6. Test production build

### Testing

1. Run all existing tests
2. Run new tests
3. Manual testing scenarios
4. Performance testing
5. Multi-client testing

### Deployment

1. Merge to main branch
2. Update documentation
3. Create release notes
4. Tag version

## Risk Mitigation

### Risk: Breaking Existing Functionality

**Mitigation**:
- All changes are additive
- No modifications to core logic
- Comprehensive test coverage
- Feature flag for WebSocket server

### Risk: Performance Impact

**Mitigation**:
- Event throttling
- Efficient broadcasting
- Memory limits on event history
- Performance testing

### Risk: WebSocket Connection Issues

**Mitigation**:
- Auto-reconnect logic
- Graceful degradation
- Clear error messages
- Fallback to HTTP polling (future)

### Risk: Complex State Management

**Mitigation**:
- Simple React Context
- Clear data flow
- Immutable updates
- State debugging tools

## Success Criteria

### Functional
- ✅ WebSocket server runs alongside HTTP server
- ✅ Events broadcast to all connected clients
- ✅ Users can send messages via UI
- ✅ Users can switch between conversations
- ✅ Real-time updates work smoothly

### Performance
- ✅ WebSocket latency < 50ms
- ✅ UI updates at 60fps
- ✅ No memory leaks in 1-hour session
- ✅ Handles 100+ events/second

### Quality
- ✅ All existing tests pass
- ✅ New code has test coverage
- ✅ No console errors
- ✅ Responsive design works
- ✅ Documentation complete

### User Experience
- ✅ Intuitive interface
- ✅ Clear visual feedback
- ✅ Smooth animations
- ✅ Helpful error messages
- ✅ "Wow factor" for demos

## Timeline Estimate

- **Phase 1-3** (Backend): 4-6 hours
- **Phase 4-5** (Frontend Setup): 2-3 hours
- **Phase 6-7** (UI Components): 6-8 hours
- **Phase 8** (Integration): 2-3 hours
- **Phase 9** (Build System): 1-2 hours
- **Phase 10** (Testing): 3-4 hours
- **Phase 11** (Documentation): 2-3 hours

**Total**: 20-29 hours

## Next Steps

1. Begin Phase 1: Backend WebSocket Infrastructure
2. Create feature branch: `feature/monitor-ui`
3. Implement incrementally with commits per phase
4. Test thoroughly at each phase
5. Merge when all phases complete

---

**Version**: 1.0  
**Status**: Implementation Plan Complete  
**Ready to Begin**: Phase 1
