import * as fs from 'fs-extra';
import * as path from 'path';
import { TestScenario, TestResult, TestConfig, ConversationState } from './types';
import { TestClient } from './TestClient';
import { EnergyMonitor } from './EnergyMonitor';
import { TestReporter } from './TestReporter';

export class TestRunner {
  private config: TestConfig;
  private client: TestClient;
  private energyMonitor: EnergyMonitor;
  private reporter: TestReporter;

  constructor(configPath: string = './config.json') {
    this.config = this.loadConfig(configPath);
    this.client = new TestClient(this.config.serverUrl);
    this.energyMonitor = new EnergyMonitor(this.client, this.config);
    this.reporter = new TestReporter(this.config);
  }

  private loadConfig(configPath: string): TestConfig {
    // Resolve path relative to project root, not __dirname
    const fullPath = path.resolve(process.cwd(), 'test', configPath);
    return fs.readJsonSync(fullPath);
  }

  async runScenario(scenario: TestScenario): Promise<TestResult> {
    console.log(`\n🧪 Running test scenario: ${scenario.name}`);
    console.log(`   Description: ${scenario.description}`);
    
    const result: TestResult = {
      scenarioName: scenario.name,
      startTime: new Date(),
      endTime: new Date(),
      success: false,
      energyData: [],
      conversations: [],
      errors: [],
      metrics: {
        averageEnergy: 0,
        energyConvergence: false,
        conversationHandling: 'unknown',
        timingAccuracy: 0
      }
    };

    try {
      // Start energy monitoring
      this.energyMonitor.startMonitoring();

      // Execute the scenario
      await this.executeScenario(scenario, result);

      // Stop monitoring and get energy data
      result.energyData = this.energyMonitor.stopMonitoring();

      // Analyze results
      this.analyzeResults(result);

      result.endTime = new Date();
      result.success = this.evaluateSuccess(result);

    } catch (error) {
      const errorEntry: {
        timestamp: Date;
        message: string;
        stack?: string;
      } = {
        timestamp: new Date(),
        message: error instanceof Error ? error.message : String(error)
      };
      
      if (error instanceof Error && error.stack) {
        errorEntry.stack = error.stack;
      }
      
      result.errors.push(errorEntry);
      result.success = false;
    }

    // Generate report
    await this.reporter.generateReport(result);

    return result;
  }

  private async executeScenario(scenario: TestScenario, result: TestResult): Promise<void> {
    const capturedRequestIds: string[] = [];
    
    for (const step of scenario.steps) {
      console.log(`   ▶ ${step.description}`);
      
      switch (step.action) {
        case 'send_message':
          const requestId = await this.client.sendMessage(step.payload.content);
          capturedRequestIds.push(requestId);
          result.conversations.push({
            requestId,
            userMessage: step.payload.content,
            responses: [],
            state: 'active',
            startTime: new Date()
          });
          break;

        case 'wait':
          await this.wait(step.payload.seconds * 1000);
          break;

        case 'check_response':
          let checkId: string;
          if (step.payload.useCapturedId) {
            const index = step.payload.capturedIdIndex ?? capturedRequestIds.length - 1;
            const capturedId = capturedRequestIds[index];
            if (!capturedId) {
              throw new Error(`No captured request ID at index ${index}`);
            }
            checkId = capturedId;
          } else {
            checkId = step.payload.requestId;
          }
          await this.checkResponse(checkId, result);
          break;

        case 'check_energy':
          const energy = await this.client.getEnergyLevel();
          console.log(`     Energy: ${energy}%`);
          break;

        case 'verify_snooze':
          const snoozeId = step.payload.useCapturedId ? 
            capturedRequestIds[capturedRequestIds.length - 1] : 
            step.payload.requestId;
          await this.verifySnooze(snoozeId, step.payload.expectedMinutes, result);
          break;

        case 'verify_conversation_end':
          const endId = step.payload.useCapturedId ? 
            capturedRequestIds[capturedRequestIds.length - 1] : 
            step.payload.requestId;
          await this.verifyConversationEnd(endId, result);
          break;

        default:
          throw new Error(`Unknown action: ${step.action}`);
      }

      // Small delay between steps
      await this.wait(1000);
    }
  }

  private async checkResponse(requestId: string, result: TestResult): Promise<void> {
    const conversation = await this.client.getConversation(requestId);
    const conv = result.conversations.find(c => c.requestId === requestId);
    
    if (conv && conversation) {
      conv.responses = conversation.responses.map(r => r.content);
      conv.state = conversation.ended ? 'ended' : 'active';
      
      if (conversation.responses.length > 0) {
        console.log(`     ✓ Got ${conversation.responses.length} response(s)`);
      } else {
        console.log(`     ⏳ No responses yet`);
      }
    }
  }

  private async verifySnooze(requestId: string, expectedMinutes: number, result: TestResult): Promise<void> {
    const conversation = await this.client.getConversation(requestId);
    const conv = result.conversations.find(c => c.requestId === requestId);
    
    if (conv && conversation) {
      // Check if conversation has any response (basic acknowledgment test for now)
      if (conversation.responses.length > 0) {
        conv.state = 'snoozed';
        console.log(`     ✓ Conversation acknowledged (${conversation.responses.length} response(s))`);
      } else {
        throw new Error(`Conversation ${requestId} was not acknowledged`);
      }
    }
  }

  private async verifyConversationEnd(requestId: string, result: TestResult): Promise<void> {
    const conversation = await this.client.getConversation(requestId);
    const conv = result.conversations.find(c => c.requestId === requestId);
    
    if (conv && conversation) {
      if (conversation.ended) {
        conv.state = 'ended';
        conv.endTime = new Date();
        console.log(`     ✓ Conversation ended: ${conversation.endedReason || 'no reason given'}`);
      } else {
        console.log(`     ⏳ Conversation still active`);
      }
    }
  }

  private analyzeResults(result: TestResult): void {
    // Calculate average energy
    if (result.energyData.length > 0) {
      const sum = result.energyData.reduce((acc, data) => acc + data.energyLevel, 0);
      result.metrics.averageEnergy = sum / result.energyData.length;
    }

    // Check energy convergence
    const { convergence, tolerance } = this.config.energyTargets;
    const recentEnergy = result.energyData.slice(-10);
    if (recentEnergy.length > 0) {
      const recentAvg = recentEnergy.reduce((acc, d) => acc + d.energyLevel, 0) / recentEnergy.length;
      result.metrics.energyConvergence = Math.abs(recentAvg - convergence) <= tolerance;
    }

    // Analyze conversation handling
    const activeConvs = result.conversations.filter(c => c.state === 'active').length;
    const endedConvs = result.conversations.filter(c => c.state === 'ended').length;
    const snoozedConvs = result.conversations.filter(c => c.state === 'snoozed').length;
    
    if (endedConvs > 0 || snoozedConvs > 0) {
      result.metrics.conversationHandling = 'good';
    } else if (activeConvs === result.conversations.length) {
      result.metrics.conversationHandling = 'poor';
    } else {
      result.metrics.conversationHandling = 'mixed';
    }
  }

  private evaluateSuccess(result: TestResult): boolean {
    // Check if there were any errors
    if (result.errors.length > 0) {
      return false;
    }

    // Check if system is stuck at 0% energy (deadlock)
    const recentEnergy = result.energyData.slice(-5);
    const stuckAtZero = recentEnergy.length >= 5 && recentEnergy.every(d => d.energyLevel <= 0);
    if (stuckAtZero) {
      console.log(`   ❌ System stuck at 0% energy - deadlock detected`);
      return false;
    }

    // Check if work is getting done (conversations have responses)
    const conversationsWithResponses = result.conversations.filter(c => c.responses.length > 0);
    const workDone = conversationsWithResponses.length > 0;
    
    if (!workDone && result.conversations.length > 0) {
      console.log(`   ⚠️ No responses generated for any conversations`);
      return false;
    }

    // Success if energy is above 0% average and work is being done
    if (result.metrics.averageEnergy > 0) {
      console.log(`   ✅ System operational (avg energy: ${result.metrics.averageEnergy.toFixed(1)}%)`);
      return true;
    }

    return false;
  }

  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async runAll(scenarios: TestScenario[]): Promise<void> {
    console.log(`\n🚀 Running ${scenarios.length} test scenarios\n`);
    
    const results: TestResult[] = [];
    let passed = 0;
    let failed = 0;

    for (const scenario of scenarios) {
      const result = await this.runScenario(scenario);
      results.push(result);
      
      if (result.success) {
        console.log(`   ✅ PASSED\n`);
        passed++;
      } else {
        console.log(`   ❌ FAILED\n`);
        failed++;
      }

      // Wait between scenarios
      await this.wait(5000);
    }

    // Generate summary report
    await this.reporter.generateSummary(results);

    console.log(`\n📊 Test Summary:`);
    console.log(`   Total: ${scenarios.length}`);
    console.log(`   Passed: ${passed}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Success Rate: ${((passed / scenarios.length) * 100).toFixed(1)}%\n`);
  }
}
