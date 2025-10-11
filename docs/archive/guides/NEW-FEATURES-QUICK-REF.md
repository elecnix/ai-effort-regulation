# New Features Quick Reference

**Version**: 1.0.1 (October 11, 2025)

## 🎯 Quick Start with New Features

### 1. Custom Port Configuration

```bash
# Start on custom port
npm start -- --port 3002

# Verify it's running
curl http://localhost:3002/health
```

### 2. Direct Energy Monitoring

```bash
# Quick energy check (lightweight)
curl http://localhost:6740/energy

# Response:
# {
#   "current": 85.5,
#   "percentage": 85,
#   "status": "high",
#   "timestamp": "2025-10-11T06:52:31.895Z"
# }
```

### 3. Conversation Filtering

```bash
# Get only active conversations
curl http://localhost:6740/conversations?state=active

# Get conversations that exceeded budget
curl http://localhost:6740/conversations?budgetStatus=exceeded

# Combine filters
curl "http://localhost:6740/conversations?state=active&budgetStatus=within&limit=20"
```

### 4. Admin/Testing Endpoints

```bash
# Manually trigger reflection (for testing)
curl -X POST http://localhost:6740/admin/trigger-reflection

# Force process a specific conversation
curl -X POST http://localhost:6740/admin/process-conversation/abc-123-def-456
```

### 5. CORS Support for Web Clients

```javascript
// Now works from browser!
fetch('http://localhost:6740/energy')
  .then(r => r.json())
  .then(data => console.log('Energy:', data.percentage + '%'));
```

## 📊 New API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/energy` | GET | Get current energy level |
| `/conversations?state=X` | GET | Filter conversations by state |
| `/conversations?budgetStatus=X` | GET | Filter by budget status |
| `/admin/trigger-reflection` | POST | Manually trigger reflection |
| `/admin/process-conversation/:id` | POST | Force process conversation |

## 🔧 New Command-Line Options

| Option | Description | Example |
|--------|-------------|---------|
| `--port <number>` | Set server port | `--port 3002` |

## 🐛 Bugs Fixed

- ✅ Test compilation now works
- ✅ Port configuration now functional
- ✅ CORS headers added for web clients
- ✅ Type safety improvements

## 📝 Enhanced Features

### Conversation Responses Now Include:

```json
{
  "conversations": [
    {
      "id": "...",
      "budgetStatus": "within",
      "energyBudget": 50,
      "energyConsumed": 25.5
    }
  ],
  "filters": {
    "state": "active",
    "budgetStatus": "within"
  }
}
```

## 💡 Usage Tips

### Monitoring Energy in Real-Time

```bash
# Watch energy level (updates every 2 seconds)
watch -n 2 'curl -s http://localhost:6740/energy | jq'
```

### Finding Problem Conversations

```bash
# Find conversations that exceeded their budget
curl -s "http://localhost:6740/conversations?budgetStatus=exceeded" | jq '.conversations[] | {id, energyBudget, energyConsumed}'
```

### Testing Reflection System

```bash
# Trigger reflection manually
curl -X POST http://localhost:6740/admin/trigger-reflection

# Check if reflection responses were added
curl -s http://localhost:6740/conversations | jq '.conversations[0].responseMessages | length'
```

## 🔐 Security Notes

### CORS Configuration

Current: Allows all origins (`*`)

For production, update `src/server.ts`:
```typescript
res.header('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || 'https://yourdomain.com');
```

### Admin Endpoints

⚠️ **Warning**: Admin endpoints have no authentication!

For production:
1. Add authentication middleware
2. Restrict to admin users
3. Add rate limiting
4. Enable audit logging

## 📚 Documentation

- **Full Test Report**: `TEST-REPORT.md`
- **Implementation Details**: `IMPROVEMENTS-IMPLEMENTED.md`
- **Complete API Reference**: `README.md`
- **Feature List**: `FEATURES.md`

## 🚀 Migration from Previous Version

No migration needed! All changes are backward compatible.

Existing code continues to work without modification.

## 🎨 Examples

### Building a Simple Dashboard

```html
<!DOCTYPE html>
<html>
<head>
  <title>AI Energy Monitor</title>
</head>
<body>
  <h1>Energy: <span id="energy">--</span>%</h1>
  <h2>Status: <span id="status">--</span></h2>
  
  <script>
    async function updateEnergy() {
      const res = await fetch('http://localhost:6740/energy');
      const data = await res.json();
      document.getElementById('energy').textContent = data.percentage;
      document.getElementById('status').textContent = data.status;
    }
    
    setInterval(updateEnergy, 2000);
    updateEnergy();
  </script>
</body>
</html>
```

### Filtering Conversations in Python

```python
import requests

# Get all active conversations that exceeded budget
response = requests.get(
    'http://localhost:6740/conversations',
    params={
        'state': 'active',
        'budgetStatus': 'exceeded',
        'limit': 50
    }
)

conversations = response.json()['conversations']
for conv in conversations:
    print(f"ID: {conv['id']}")
    print(f"Budget: {conv['energyBudget']}, Used: {conv['energyConsumed']}")
    print()
```

### Monitoring Script

```bash
#!/bin/bash
# monitor-energy.sh

while true; do
  energy=$(curl -s http://localhost:6740/energy | jq -r '.percentage')
  status=$(curl -s http://localhost:6740/energy | jq -r '.status')
  
  echo "[$(date)] Energy: $energy% ($status)"
  
  if [ "$energy" -lt 20 ]; then
    echo "⚠️  WARNING: Low energy!"
  fi
  
  sleep 5
done
```

## 🔍 Troubleshooting

### Port Already in Use

```bash
# Check what's using the port
lsof -i :6740

# Use a different port
npm start -- --port 6741
```

### CORS Issues

If you still get CORS errors:
1. Check browser console for exact error
2. Verify server is running
3. Try with `curl` to isolate issue
4. Check if browser extension is blocking

### Energy Not Updating

```bash
# Check if system is running
curl http://localhost:6740/health

# Check energy endpoint directly
curl http://localhost:6740/energy

# Verify replenish rate
# (should be 1 unit/second by default)
```

## 📞 Support

For issues or questions:
1. Check `TEST-REPORT.md` for known issues
2. Review `IMPROVEMENTS-IMPLEMENTED.md` for implementation details
3. See `README.md` for complete documentation

## ✨ What's Next?

Planned improvements (not yet implemented):
- UUID uniqueness validation
- WebSocket support for real-time updates
- Mock LLM provider for testing
- Budget analytics endpoint
- Admin authentication
- Architecture diagrams
- Troubleshooting guide

See `TEST-REPORT.md` for complete roadmap.
