import { TestClient } from '../framework/TestClient';
import { TestScenario } from '../framework/types';

export const zeroBudgetScenario: TestScenario = {
  name: 'Zero Budget (Last Chance)',
  description: 'User sends message with zero energy budget - AI should respond immediately with critical info',
  
  async run(client: TestClient): Promise<boolean> {
    console.log('\n🧪 Testing Zero Budget Scenario...');
    
    // Send message with zero budget
    const requestId = await client.sendMessage(
      'Emergency: The production server is down. What are the first 3 things I should check?',
      0  // Zero budget - last chance
    );
    
    console.log(`📨 Sent emergency message with ZERO budget (requestId: ${requestId})`);
    
    // Wait for response (should be quick)
    let conversation = null;
    let attempts = 0;
    const maxAttempts = 60; // 30 seconds max
    
    while (attempts < maxAttempts) {
      await client.sleep(500);
      conversation = await client.getConversation(requestId);
      
      if (conversation && conversation.responses && conversation.responses.length > 0) {
        console.log(`✅ Received response after ${attempts * 0.5} seconds`);
        break;
      }
      
      attempts++;
    }
    
    if (!conversation || !conversation.responses || conversation.responses.length === 0) {
      console.error('❌ No response received within timeout');
      return false;
    }
    
    // Verify response
    const response = conversation.responses[0];
    if (!response) {
      console.error('❌ No response in conversation');
      return false;
    }
    console.log(`📝 Response: ${response.content.substring(0, 200)}...`);
    
    // Check budget metadata
    if (conversation.metadata.energyBudget !== 0) {
      console.error(`❌ Budget should be 0, got: ${conversation.metadata.energyBudget}`);
      return false;
    }
    
    console.log(`💰 Budget: ${conversation.metadata.energyBudget} (zero - last chance)`);
    console.log(`⚡ Energy consumed: ${conversation.metadata.totalEnergyConsumed}`);
    console.log(`📊 Budget status: ${conversation.metadata.budgetStatus}`);
    
    // Verify response is concise but useful
    if (response.content.length < 20) {
      console.error('❌ Response too short - should provide critical information');
      return false;
    }
    
    // Check if conversation ended (should end after zero budget response)
    await client.sleep(2000);
    conversation = await client.getConversation(requestId);
    
    if (conversation && conversation.ended) {
      console.log('✅ Conversation ended after zero-budget response');
    } else {
      console.log('⚠️  Conversation not ended (acceptable - soft limit)');
    }
    
    console.log('✅ Zero budget scenario passed');
    return true;
  }
};
