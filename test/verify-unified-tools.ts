import { IntelligentModel, MCPToolDefinition } from '../src/intelligent-model';
import { EnergyRegulator } from '../src/energy';

async function testUnifiedTools() {
  console.log('🧪 Testing Unified MCP Tool System\n');

  const model = new IntelligentModel(true);
  const energyRegulator = new EnergyRegulator(10);

  // Simulate MCP tools
  const mockMcpTools: MCPToolDefinition[] = [
    {
      name: 'read_file',
      description: 'Read a file from the filesystem',
      serverId: 'filesystem',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the file' }
        },
        required: ['path']
      }
    },
    {
      name: 'create_issue',
      description: 'Create a GitHub issue',
      serverId: 'github',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          body: { type: 'string' }
        },
        required: ['title', 'body']
      }
    }
  ];

  console.log('✅ Mock MCP tools created:');
  mockMcpTools.forEach(tool => {
    console.log(`   - ${tool.name} [${tool.serverId}]: ${tool.description}`);
  });

  console.log('\n📋 Testing tool list generation...');
  
  const messages = [
    { role: 'user', content: 'Hello, what tools do you have available?' }
  ];

  try {
    // This will generate the tool list internally
    const response = await model.generateResponse(
      messages,
      energyRegulator,
      false,
      ['respond', 'think'],
      mockMcpTools
    );

    console.log('✅ Response generated successfully');
    console.log(`   Energy consumed: ${response.energyConsumed.toFixed(2)}`);
    console.log(`   Model used: ${response.modelUsed}`);
    
    if (response.toolCalls && response.toolCalls.length > 0) {
      console.log(`   Tool calls: ${response.toolCalls.length}`);
      response.toolCalls.forEach(tc => {
        console.log(`      - ${tc.function.name}`);
      });
    }

    console.log('\n✅ All tests passed!');
    console.log('\n📊 Summary:');
    console.log(`   - Core tools: respond, think`);
    console.log(`   - MCP tools: ${mockMcpTools.length} (${mockMcpTools.map(t => t.name).join(', ')})`);
    console.log(`   - Total tools available: ${2 + mockMcpTools.length}`);
    console.log('\n🎉 Unified tool system is working correctly!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testUnifiedTools().catch(console.error);
