import { TestClient } from '../framework/TestClient';
import { TestScenario } from '../framework/types';

export const noBudgetScenario: TestScenario = {
  name: 'No Budget (Default Behavior)',
  description: 'User sends message without energy budget - AI uses default energy management',
  
  async run(client: TestClient): Promise<boolean> {
    console.log('\n🧪 Testing No Budget Scenario...');
    
    // Send message without budget
    const requestId = await client.sendMessage(
      'What are some interesting facts about quantum computing?'
      // No budget parameter
    );
    
    console.log(`📨 Sent message WITHOUT budget (requestId: ${requestId})`);
    
    // Wait for response
    let conversation = null;
    let attempts = 0;
    const maxAttempts = 60;
    
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
    
    // Check that no budget was set
    if (conversation.metadata.energyBudget !== undefined && conversation.metadata.energyBudget !== null) {
      console.error(`❌ Budget should be undefined/null, got: ${conversation.metadata.energyBudget}`);
      return false;
    }
    
    console.log(`💰 Budget: Not set (default behavior)`);
    console.log(`⚡ Energy consumed: ${conversation.metadata.totalEnergyConsumed.toFixed(1)} units`);
    console.log(`📊 Budget status: ${conversation.metadata.budgetStatus || 'N/A'}`);
    
    // Verify budgetStatus is null or undefined
    if (conversation.metadata.budgetStatus !== undefined && conversation.metadata.budgetStatus !== null) {
      console.error(`❌ Budget status should be undefined/null, got: ${conversation.metadata.budgetStatus}`);
      return false;
    }
    
    // Verify response is reasonable
    if (response && response.content.length < 20) {
      console.error('❌ Response too short');
      return false;
    }
    
    console.log('✅ Response generated with default energy management');
    console.log('✅ No budget scenario passed');
    return true;
  }
};
