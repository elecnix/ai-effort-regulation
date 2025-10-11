import { TestClient } from '../framework/TestClient';
import { TestScenario, ConversationResponse } from '../framework/types';

export const budgetExceededScenario: TestScenario = {
  name: 'Budget Exceeded',
  description: 'User sends complex question with very low budget - AI should exceed budget if necessary',
  
  async run(client: TestClient): Promise<boolean> {
    console.log('\n🧪 Testing Budget Exceeded Scenario...');
    
    const budget = 3; // Very low budget for complex question
    
    // Send complex message with insufficient budget
    const requestId = await client.sendMessage(
      'Explain in detail how neural networks learn through backpropagation, including the mathematical concepts.',
      budget
    );
    
    console.log(`📨 Sent complex question with very low budget of ${budget} units (requestId: ${requestId})`);
    
    // Wait for response
    let conversation: ConversationResponse | null = null;
    let attempts = 0;
    const maxAttempts = 120;
    
    while (attempts < maxAttempts) {
      await client.sleep(500);
      conversation = await client.getConversation(requestId);
      
      if (conversation && conversation.responses && conversation.responses.length > 0) {
        const consumed = conversation.metadata.totalEnergyConsumed;
        
        // Wait a bit longer to see if AI wraps up after exceeding budget
        if (consumed > budget) {
          console.log(`⚡ Budget exceeded at ${attempts * 0.5} seconds`);
          // Wait a bit more to see final state
          await client.sleep(2000);
          conversation = await client.getConversation(requestId);
          break;
        }
      }
      
      attempts++;
    }
    
    if (!conversation || !conversation.responses || conversation.responses.length === 0) {
      console.error('❌ No response received within timeout');
      return false;
    }
    
    // Verify response
    console.log(`📝 Received ${conversation.responses.length} response(s)`);
    const fullResponse = conversation.responses.map(r => r.content).join('\n');
    console.log(`📝 Response length: ${fullResponse.length} characters`);
    console.log(`📝 First 200 chars: ${fullResponse.substring(0, 200)}...`);
    
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
    
    // Verify budget was exceeded (soft limit)
    if (consumed <= budget) {
      console.warn('⚠️  Budget not exceeded - AI may have been too conservative');
      // This is acceptable - AI might have provided minimal answer
    } else {
      console.log('✅ Budget exceeded as expected (soft limit allows this)');
      
      // Verify status is "exceeded"
      if (conversation.metadata.budgetStatus !== 'exceeded') {
        console.error(`❌ Budget status should be "exceeded", got: ${conversation.metadata.budgetStatus}`);
        return false;
      }
    }
    
    // Verify response still provides value
    if (fullResponse.length < 50) {
      console.error('❌ Response too short - should still provide useful information');
      return false;
    }
    
    console.log('✅ AI handled budget constraint appropriately');
    console.log('✅ Budget exceeded scenario passed');
    return true;
  }
};
