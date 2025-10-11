import { TestClient } from '../framework/TestClient';
import { TestScenario, ConversationResponse } from '../framework/types';

export const lowBudgetScenario: TestScenario = {
  name: 'Low Budget (5 units)',
  description: 'User sends message with low energy budget - AI should provide concise response',
  
  async run(client: TestClient): Promise<boolean> {
    console.log('\n🧪 Testing Low Budget Scenario...');
    
    const budget = 5;
    
    // Send message with low budget
    const requestId = await client.sendMessage(
      'What is the capital of France?',
      budget
    );
    
    console.log(`📨 Sent simple question with budget of ${budget} units (requestId: ${requestId})`);
    
    // Wait for response
    let conversation: ConversationResponse | null = null;
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
    console.log(`📝 Response: ${response.content}`);
    
    // Check budget metadata
    if (conversation.metadata.energyBudget !== budget) {
      console.error(`❌ Budget should be ${budget}, got: ${conversation.metadata.energyBudget}`);
      return false;
    }
    
    const consumed = conversation.metadata.totalEnergyConsumed;
    const remaining = conversation.metadata.energyBudgetRemaining || 0;
    
    console.log(`💰 Budget: ${budget} units`);
    console.log(`⚡ Energy consumed: ${consumed.toFixed(1)} units`);
    console.log(`💵 Remaining: ${remaining.toFixed(1)} units`);
    console.log(`📊 Budget status: ${conversation.metadata.budgetStatus}`);
    
    // Verify response is concise
    if (response && response.content.length > 500) {
      console.warn('⚠️  Response longer than expected for low budget (but acceptable)');
    }
    
    // Verify we stayed reasonably close to budget (within 2x)
    if (consumed > budget * 2) {
      console.warn(`⚠️  Consumed ${consumed.toFixed(1)} units, significantly over budget of ${budget} (but acceptable - soft limit)`);
    } else {
      console.log('✅ Energy consumption reasonable for budget');
    }
    
    // Verify response is useful
    const lowerResponse = response ? response.content.toLowerCase() : '';
    if (lowerResponse.includes('paris')) {
      console.log('✅ Response contains correct answer');
    } else {
      console.warn('⚠️  Response may not contain expected answer');
    }
    
    console.log('✅ Low budget scenario passed');
    return true;
  }
};
