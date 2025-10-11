# Monitor UI - Quick Start Guide

## 🚀 Get Started in 3 Steps

### Step 1: Build the System
```bash
npm run build
```

This builds both the backend and the React frontend.

### Step 2: Start the System
```bash
npm start
```

The system starts on port 6740 (or next available port).

### Step 3: Open the Monitor UI
```bash
# Open in your browser
http://localhost:6740/
```

## 🎯 What You'll See

### System Health Bar (Top)
- **Energy Gauge**: Shows current energy level with color coding
  - 🟢 Green (>50): High energy
  - 🟡 Yellow (20-50): Medium energy
  - 🟠 Orange (0-20): Low energy
  - 🔴 Red (<0): Urgent mode
- **Statistics**: Conversations, responses, uptime, etc.

### Conversation List (Left)
- All conversations with state indicators
- Click to view conversation details
- Shows message count and energy consumed

### Chat Panel (Center)
- Send messages to the AI
- View conversation history
- Set optional energy budgets

### Event Stream (Right)
- Real-time system events
- Color-coded by type
- Last 100 events displayed

## 💬 Try It Out

### Send Your First Message

1. Type a message in the input field (center panel)
2. (Optional) Enter an energy budget (e.g., 20)
3. Click Send or press Enter
4. Watch the magic happen:
   - New conversation appears in left panel
   - AI response appears in chat panel
   - Events stream in right panel
   - Energy gauge updates in real-time

### Example Messages

**Simple Question** (Budget: 5-10)
```
What is the capital of France?
```

**Standard Question** (Budget: 20-30)
```
Explain how HTTPS works
```

**Complex Analysis** (Budget: 40-60)
```
Compare microservices vs monolithic architecture
```

**Emergency** (Budget: 0)
```
Server is down! What should I check first?
```

## 🔍 What to Observe

### Energy Management
- Watch energy decrease as AI processes
- See energy replenish during idle periods
- Notice model switches when energy crosses 50

### Adaptive Behavior
- High energy: Detailed, complex responses
- Low energy: Concise, efficient responses
- Model switches: 3b → 1b as energy drops

### Real-Time Events
- 🟡 Energy updates
- 🔵 New messages
- 🟣 Model switches
- 🟠 Sleep cycles
- 🟢 Tool invocations

## 🎨 Tips & Tricks

### Multiple Conversations
- Send several messages to create multiple conversations
- Click between them to switch views
- All conversations update in real-time

### Energy Budgets
- Leave empty for default behavior
- Use low budgets (5-10) for quick answers
- Use high budgets (40-60) for deep analysis
- Use 0 for emergency "last chance" mode

### Event Stream
- Scroll to see past events
- Color indicates event type
- Auto-scrolls to latest event

### Development Mode
For frontend development with hot-reload:
```bash
# Terminal 1: Backend
npm run dev

# Terminal 2: Frontend
npm run dev:frontend
# Opens at http://localhost:5173
```

## 📊 Understanding the Display

### Energy Colors
- **Green**: System is healthy, full capabilities
- **Yellow**: Moderate energy, still capable
- **Orange**: Low energy, conservation mode
- **Red**: Critical, urgent mode only

### Conversation States
- **Green dot**: Active conversation
- **Yellow dot**: Snoozed (paused)
- **Gray dot**: Ended (completed)

### Event Colors
- **Yellow**: Energy changes
- **Blue**: Conversations/messages
- **Purple**: Model switches
- **Indigo**: Sleep start
- **Orange**: Sleep end
- **Green**: Tool calls
- **Red**: Errors

## 🐛 Troubleshooting

### "Connecting..." Won't Go Away
- Check backend is running: `curl http://localhost:6740/health`
- Refresh the page
- Check browser console (F12) for errors

### No Events Appearing
- Verify WebSocket connection (check connection status)
- Send a test message to trigger events
- Refresh the page

### Conversations Not Loading
- Send a message to create a conversation
- Check backend logs for errors
- Verify database is accessible

## 📚 Learn More

- **[Monitor UI Guide](./MONITOR-UI-GUIDE.md)**: Comprehensive user guide
- **[Monitor UI Spec](./MONITOR-UI-SPEC.md)**: Technical specification
- **[User Guide](./USER-GUIDE.md)**: Full system documentation
- **[Features](./FEATURES.md)**: Complete feature list

## 🎓 Next Steps

1. **Experiment with Energy Budgets**: Try different budgets to see how the AI adapts
2. **Watch Model Switches**: Send multiple messages to deplete energy and trigger switches
3. **Observe Sleep Cycles**: Let the system run idle to see energy recovery
4. **Multiple Conversations**: Create several conversations and switch between them
5. **Read the Docs**: Explore the comprehensive documentation

## 🎉 You're Ready!

The Monitor UI gives you unprecedented visibility into the AI's "thought process". Use it to:
- **Understand** how energy regulation works
- **Debug** conversation behavior
- **Demonstrate** adaptive AI to stakeholders
- **Develop** new features with confidence

Enjoy exploring the system! 🚀

---

**Quick Links**:
- Monitor UI: http://localhost:6740/
- REST API: http://localhost:6740/message
- Health Check: http://localhost:6740/health
- Stats: http://localhost:6740/stats
