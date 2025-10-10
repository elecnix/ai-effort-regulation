#!/usr/bin/env node

import * as fs from 'fs-extra';
import * as path from 'path';

interface TestReport {
  scenarioName: string;
  success: boolean;
  analysis: {
    energyAnalysis: {
      average: number;
      converged: boolean;
      trend: string;
      depletionEvents: number;
      stabilityScore: number;
    };
    conversationAnalysis: {
      totalConversations: number;
      activeConversations: number;
      endedConversations: number;
      snoozedConversations: number;
      averageResponseCount: number;
      handlingQuality: string;
    };
  };
  recommendations: string[];
}

async function analyzeResults() {
  const reportDir = path.resolve(__dirname, '../test-reports');
  
  if (!fs.existsSync(reportDir)) {
    console.error('No test reports found. Run tests first with: npm test');
    process.exit(1);
  }

  const files = fs.readdirSync(reportDir).filter(f => f.endsWith('.json'));
  
  if (files.length === 0) {
    console.error('No test report files found in test-reports directory');
    process.exit(1);
  }

  console.log('\n📊 Test Results Analysis\n');
  console.log('=' .repeat(60));

  const allReports: TestReport[] = [];
  
  for (const file of files) {
    const filepath = path.join(reportDir, file);
    const report = fs.readJsonSync(filepath) as TestReport;
    allReports.push(report);
  }

  // Analyze patterns
  const patterns = analyzePatterns(allReports);
  
  // Generate prompt improvement suggestions
  const suggestions = generatePromptSuggestions(patterns);
  
  // Display results
  displayAnalysis(patterns, suggestions);
}

interface Patterns {
  energyDepletion: boolean;
  poorConvergence: boolean;
  conversationManagement: string;
  snoozeEffectiveness: boolean;
  averageEnergyLevel: number;
  stabilityScore: number;
}

function analyzePatterns(reports: TestReport[]): Patterns {
  const energyLevels = reports.map(r => r.analysis.energyAnalysis.average);
  const avgEnergy = energyLevels.reduce((a, b) => a + b, 0) / energyLevels.length;
  
  const depletionEvents = reports.reduce((sum, r) => sum + r.analysis.energyAnalysis.depletionEvents, 0);
  const convergenceRate = reports.filter(r => r.analysis.energyAnalysis.converged).length / reports.length;
  
  const conversationQualities = reports.map(r => r.analysis.conversationAnalysis.handlingQuality);
  const poorHandling = conversationQualities.filter(q => q === 'poor').length;
  const goodHandling = conversationQualities.filter(q => q === 'good').length;
  
  const avgStability = reports.reduce((sum, r) => sum + r.analysis.energyAnalysis.stabilityScore, 0) / reports.length;
  
  return {
    energyDepletion: depletionEvents > reports.length * 3,
    poorConvergence: convergenceRate < 0.5,
    conversationManagement: poorHandling > goodHandling ? 'poor' : 'good',
    snoozeEffectiveness: reports.some(r => r.scenarioName.includes('Snooze') && r.success),
    averageEnergyLevel: avgEnergy,
    stabilityScore: avgStability
  };
}

function generatePromptSuggestions(patterns: Patterns): string[] {
  const suggestions: string[] = [];
  
  if (patterns.energyDepletion) {
    suggestions.push(`
## Energy Depletion Prevention

The model is getting stuck at 0% energy. Add to the system prompt:

"CRITICAL: Never let your energy reach 0% for extended periods. If energy drops below 10%, 
immediately use await_energy to recover. The goal is to maintain enough energy to respond 
to conversations and handle unsnooze events. Any energy level above 0% is acceptable as 
long as you can continue working."
    `);
  }
  
  if (patterns.poorConvergence && patterns.averageEnergyLevel < 5) {
    suggestions.push(`
## Deadlock Prevention

The model's energy is too low to function properly. Add to the system prompt:

"You must maintain minimum operational energy (>5%) to handle incoming requests. Use 
await_energy BEFORE you hit 0%. Remember: the goal is to DO WORK, not to maintain 
high energy. As long as you can respond to messages, your energy level is acceptable."
    `);
  }
  
  if (patterns.conversationManagement === 'poor') {
    suggestions.push(`
## Conversation Management Prompt Improvement

The model is not properly managing conversations. Add to the system prompt:

"Recognize when conversations become one-sided. If a user hasn't responded after your 
initial response, use snooze_conversation with exponential backoff (30s, 1m, 2m, 5m, etc). 
End conversations that have been inactive for more than 30 minutes or where the user's 
intent has been fulfilled."
    `);
  }
  
  if (patterns.averageEnergyLevel < 30) {
    suggestions.push(`
## Low Energy Baseline Prompt Improvement

The model operates at very low energy levels. Add to the system prompt:

"Your baseline energy should be around 50%. If you find yourself consistently below 30%, 
you're being too aggressive with responses. Use shorter, more efficient responses when 
energy is below 50%, and await_energy more frequently."
    `);
  }
  
  if (patterns.stabilityScore < 50) {
    suggestions.push(`
## Energy Stability Prompt Improvement

The model's energy fluctuates too much. Add to the system prompt:

"Maintain steady energy levels by balancing activity with recovery. Avoid rapid energy 
consumption followed by long recovery periods. Instead, take regular short breaks using 
await_energy to maintain stability."
    `);
  }
  
  return suggestions;
}

function displayAnalysis(patterns: Patterns, suggestions: string[]) {
  console.log('\n📈 Pattern Analysis:\n');
  console.log(`  Average Energy Level: ${patterns.averageEnergyLevel.toFixed(1)}%`);
  console.log(`  Energy Stability Score: ${patterns.stabilityScore.toFixed(1)}/100`);
  console.log(`  Energy Depletion Issues: ${patterns.energyDepletion ? '❌ Yes' : '✅ No'}`);
  console.log(`  Poor Convergence: ${patterns.poorConvergence ? '❌ Yes' : '✅ No'}`);
  console.log(`  Conversation Management: ${patterns.conversationManagement === 'good' ? '✅ Good' : '❌ Poor'}`);
  console.log(`  Snooze Feature Working: ${patterns.snoozeEffectiveness ? '✅ Yes' : '❌ No'}`);
  
  if (suggestions.length > 0) {
    console.log('\n💡 Prompt Improvement Suggestions:\n');
    console.log('=' .repeat(60));
    
    for (const suggestion of suggestions) {
      console.log(suggestion);
    }
    
    // Save suggestions to file
    const suggestionsPath = path.resolve(__dirname, '../test-reports/prompt-suggestions.md');
    fs.writeFileSync(suggestionsPath, suggestions.join('\n\n'));
    console.log(`\n📝 Suggestions saved to: test-reports/prompt-suggestions.md`);
  } else {
    console.log('\n✨ No prompt improvements needed - system is performing well!');
  }
  
  console.log('\n' + '=' .repeat(60) + '\n');
}

// Run the analysis
analyzeResults().catch(error => {
  console.error('Error analyzing results:', error);
  process.exit(1);
});
