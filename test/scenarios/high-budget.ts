import { TestClient } from '../framework/TestClient';
import { TestScenario, ConversationResponse } from '../framework/types';

export const highBudgetScenario: TestScenario = {
  name: 'High Budget (50 units)',
  description: 'User sends message with high energy budget - AI can provide detailed response',
  
  async run(client: TestClient): Promise<boolean> {
    console.log('\n🧪 Testing High Budget Scenario...');
    
    const budget = 50;
    
    // Send message with high budget
    const requestId = await client.sendMessage(
      'Explain the key differences between microservices and monolithic architecture, including pros and cons of each.',
      budget
    );
    
    console.log(`📨 Sent complex question with budget of ${budget} units (requestId: ${requestId})`);
    
    // Wait for response(s)
    let conversation: ConversationResponse | null = null;
    let attempts = 0;
    const maxAttempts = 120; // Give more time for detailed response
    
    while (attempts < maxAttempts) {
      await client.sleep(500);
      conversation = await client.getConversation(requestId);
      
      if (conversation && conversation.responses && conversation.responses.length > 0) {
        const consumed = conversation.metadata.totalEnergyConsumed;
        const remaining = conversation.metadata.energyBudgetRemaining || 0;
        
        // Check if AI is done (either ended or budget mostly used)
        if (conversation.ended || remaining < budget * 0.1) {
          console.log(`✅ Response complete after ${attempts * 0.5} seconds`);
          break;
        }
      }
      
      attempts++;
    }
    
    if (!conversation || !conversation.responses || conversation.responses.length === 0) {
      console.error('❌ No response received within timeout');
      return false;
    }
    
    // Verify responses
    console.log(`📝 Received ${conversation.responses.length} response(s)`);
    const fullResponse = conversation.responses.map(r => r.content).join('\n');
    console.log(`📝 Total response length: ${fullResponse.length} characters`);
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
    
    // Verify response is detailed (should use significant portion of budget)
    if (fullResponse.length < 100) {
      console.warn('⚠️  Response shorter than expected for high budget');
    } else {
      console.log('✅ Response is appropriately detailed');
    }
    
    // Verify we used a reasonable amount of the budget
    if (consumed < budget * 0.1) {
      console.warn('⚠️  Used very little of available budget (but acceptable)');
    } else {
      console.log('✅ Made good use of available budget');
    }
    
    // Verify response quality (should mention key concepts)
    const lowerResponse = fullResponse.toLowerCase();
    const hasRelevantContent = 
      lowerResponse.includes('microservice') || 
      lowerResponse.includes('monolith') ||
      lowerResponse.includes('architecture');
    
    if (hasRelevantContent) {
      console.log('✅ Response contains relevant technical content');
    } else {
      console.warn('⚠️  Response may not fully address the question');
    }
    
    console.log('✅ High budget scenario passed');
    return true;
  }
};
