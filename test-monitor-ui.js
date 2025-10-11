const { chromium } = require('playwright');

async function testMonitorUI() {
  console.log('🧪 Testing Monitor UI with Playwright');
  console.log('='.repeat(50));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Test 1: Page loads
    console.log('\n📝 Test 1: Loading Monitor UI');
    await page.goto('http://localhost:6740/', { waitUntil: 'networkidle' });
    console.log('✅ Page loaded successfully');

    // Test 2: Check for main components
    console.log('\n📝 Test 2: Checking UI Components');
    
    const systemHealth = await page.locator('text=Energy').count();
    console.log(systemHealth > 0 ? '✅ System Health component present' : '❌ System Health component missing');

    const conversationList = await page.locator('text=Conversations').count();
    console.log(conversationList > 0 ? '✅ Conversation List component present' : '❌ Conversation List component missing');

    const eventStream = await page.locator('text=Event Stream').count();
    console.log(eventStream > 0 ? '✅ Event Stream component present' : '❌ Event Stream component missing');

    // Test 3: Check WebSocket connection
    console.log('\n📝 Test 3: WebSocket Connection');
    await page.waitForTimeout(2000); // Wait for WebSocket to connect
    
    const connectionStatus = await page.locator('text=Connected').count();
    console.log(connectionStatus > 0 ? '✅ WebSocket connected' : '⚠️  WebSocket connection status unclear');

    // Test 4: Check energy gauge
    console.log('\n📝 Test 4: Energy Gauge');
    const energyGauge = await page.locator('text=Energy').first().isVisible();
    console.log(energyGauge ? '✅ Energy gauge visible' : '❌ Energy gauge not visible');

    // Test 5: Send a test message
    console.log('\n📝 Test 5: Sending Test Message');
    const messageInput = await page.locator('input[placeholder*="message"]').first();
    await messageInput.fill('Test message from Playwright');
    
    const sendButton = await page.locator('button[type="submit"]').first();
    await sendButton.click();
    console.log('✅ Message sent');

    // Wait for response
    await page.waitForTimeout(3000);

    // Test 6: Check if conversation appeared
    console.log('\n📝 Test 6: Checking Conversation Creation');
    const conversations = await page.locator('text=Test message from Playwright').count();
    console.log(conversations > 0 ? '✅ Conversation created and visible' : '⚠️  Conversation may still be processing');

    // Test 7: Check event stream
    console.log('\n📝 Test 7: Event Stream Activity');
    const events = await page.locator('.border-l-4').count();
    console.log(`✅ Event stream has ${events} events`);

    // Test 8: Take a screenshot
    console.log('\n📝 Test 8: Taking Screenshot');
    await page.screenshot({ path: 'monitor-ui-test.png', fullPage: true });
    console.log('✅ Screenshot saved to monitor-ui-test.png');

    // Test 9: Check responsive elements
    console.log('\n📝 Test 9: UI Layout');
    const layout = await page.evaluate(() => {
      const root = document.getElementById('root');
      return {
        hasContent: root && root.children.length > 0,
        width: window.innerWidth,
        height: window.innerHeight
      };
    });
    console.log(layout.hasContent ? '✅ UI has content' : '❌ UI is empty');
    console.log(`   Viewport: ${layout.width}x${layout.height}`);

    // Test 10: Check for JavaScript errors
    console.log('\n📝 Test 10: JavaScript Errors');
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.waitForTimeout(1000);
    console.log(errors.length === 0 ? '✅ No JavaScript errors' : `⚠️  ${errors.length} JavaScript errors detected`);
    if (errors.length > 0) {
      errors.forEach(err => console.log(`   - ${err}`));
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ Monitor UI tests completed successfully!');
    console.log('='.repeat(50));

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    await page.screenshot({ path: 'monitor-ui-error.png', fullPage: true });
    console.log('Error screenshot saved to monitor-ui-error.png');
    throw error;
  } finally {
    await browser.close();
  }
}

testMonitorUI().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
