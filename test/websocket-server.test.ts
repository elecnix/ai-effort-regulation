import { WebSocketServer } from '../src/websocket-server';
import { WebSocketServer as WSServer } from 'ws';

console.log('🧪 WebSocket Server Tests');
console.log('='.repeat(50));

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`✅ ${message}`);
    testsPassed++;
  } else {
    console.log(`❌ ${message}`);
    testsFailed++;
  }
}

async function runTests() {
  console.log('\n📝 Test 1: WebSocket Server Creation');
  try {
    const wss = new WSServer({ port: 0 });
    const wsServer = new WebSocketServer(wss);
    assert(wsServer !== null, 'WebSocket server created successfully');
    assert(wsServer.getClientCount() === 0, 'Initial client count is 0');
    wsServer.close();
    wss.close();
  } catch (error) {
    assert(false, `WebSocket server creation failed: ${error}`);
  }

  console.log('\n📝 Test 2: Message Handler Registration');
  try {
    const wss = new WSServer({ port: 0 });
    const wsServer = new WebSocketServer(wss);
    
    let handlerCalled = false;
    wsServer.registerHandler('test_message', () => {
      handlerCalled = true;
    });
    
    assert(true, 'Handler registered without error');
    
    wsServer.close();
    wss.close();
  } catch (error) {
    assert(false, `Handler registration failed: ${error}`);
  }

  console.log('\n📝 Test 3: Broadcast Message');
  try {
    const wss = new WSServer({ port: 0 });
    const wsServer = new WebSocketServer(wss);
    
    wsServer.broadcast({
      type: 'test',
      payload: { data: 'test' },
      timestamp: new Date().toISOString()
    });
    
    assert(true, 'Broadcast message sent without error');
    
    wsServer.close();
    wss.close();
  } catch (error) {
    assert(false, `Broadcast failed: ${error}`);
  }

  console.log('\n' + '='.repeat(50));
  console.log(`✅ Tests Passed: ${testsPassed}`);
  console.log(`❌ Tests Failed: ${testsFailed}`);
  console.log('='.repeat(50));

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTests().catch(console.error);
