import * as fs from 'fs-extra';
import * as path from 'path';
import { TestConfig, TestResult } from './types';

export class TestReporter {
  private config: TestConfig;
  private reportDir: string;

  constructor(config: TestConfig) {
    this.config = config;
    this.reportDir = path.resolve(config.testSettings.reportDir);
    
    // Ensure report directory exists
    fs.ensureDirSync(this.reportDir);
  }

  async generateReport(result: TestResult): Promise<void> {
    if (!this.config.testSettings.saveReports) return;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${result.scenarioName.replace(/\s+/g, '-')}_${timestamp}.json`;
    const filepath = path.join(this.reportDir, filename);

    const report = {
      ...result,
      analysis: this.analyzeResult(result),
      recommendations: this.generateRecommendations(result)
    };

    await fs.writeJson(filepath, report, { spaces: 2 });
    console.log(`   📝 Report saved: ${filename}`);
  }

  private analyzeResult(result: TestResult): any {
    const analysis = {
      energyAnalysis: {
        average: result.metrics.averageEnergy,
        converged: result.metrics.energyConvergence,
        trend: this.calculateEnergyTrend(result.energyData),
        depletionEvents: this.countDepletionEvents(result.energyData),
        stabilityScore: this.calculateStabilityScore(result.energyData)
      },
      conversationAnalysis: {
        totalConversations: result.conversations.length,
        activeConversations: result.conversations.filter(c => c.state === 'active').length,
        endedConversations: result.conversations.filter(c => c.state === 'ended').length,
        snoozedConversations: result.conversations.filter(c => c.state === 'snoozed').length,
        averageResponseCount: this.calculateAverageResponseCount(result.conversations),
        handlingQuality: result.metrics.conversationHandling
      },
      timingAnalysis: {
        totalDuration: (result.endTime.getTime() - result.startTime.getTime()) / 1000,
        averageResponseTime: this.calculateAverageResponseTime(result.conversations)
      },
      errorAnalysis: {
        errorCount: result.errors.length,
        errorTypes: this.categorizeErrors(result.errors)
      }
    };

    return analysis;
  }

  private calculateEnergyTrend(energyData: any[]): string {
    if (energyData.length < 3) return 'insufficient_data';

    const firstThird = energyData.slice(0, Math.floor(energyData.length / 3));
    const lastThird = energyData.slice(-Math.floor(energyData.length / 3));

    const firstAvg = firstThird.reduce((sum, d) => sum + d.energyLevel, 0) / firstThird.length;
    const lastAvg = lastThird.reduce((sum, d) => sum + d.energyLevel, 0) / lastThird.length;

    const difference = lastAvg - firstAvg;

    if (Math.abs(difference) < 10) return 'stable';
    if (difference > 10) return 'recovering';
    return 'declining';
  }

  private countDepletionEvents(energyData: any[]): number {
    return energyData.filter(d => d.energyLevel < 10).length;
  }

  private calculateStabilityScore(energyData: any[]): number {
    if (energyData.length < 2) return 0;

    // Calculate variance
    const avg = energyData.reduce((sum, d) => sum + d.energyLevel, 0) / energyData.length;
    const variance = energyData.reduce((sum, d) => {
      const diff = d.energyLevel - avg;
      return sum + (diff * diff);
    }, 0) / energyData.length;

    const stdDev = Math.sqrt(variance);
    
    // Lower standard deviation = higher stability score
    return Math.max(0, 100 - stdDev * 2);
  }

  private calculateAverageResponseCount(conversations: any[]): number {
    if (conversations.length === 0) return 0;
    
    const totalResponses = conversations.reduce((sum, c) => sum + c.responses.length, 0);
    return totalResponses / conversations.length;
  }

  private calculateAverageResponseTime(conversations: any[]): number {
    // This would need actual response time tracking
    // For now, return a placeholder
    return 0;
  }

  private categorizeErrors(errors: any[]): Record<string, number> {
    const categories: Record<string, number> = {};
    
    for (const error of errors) {
      const category = this.getErrorCategory(error.message);
      categories[category] = (categories[category] || 0) + 1;
    }

    return categories;
  }

  private getErrorCategory(message: string): string {
    if (message.includes('timeout')) return 'timeout';
    if (message.includes('connection')) return 'connection';
    if (message.includes('energy')) return 'energy';
    if (message.includes('conversation')) return 'conversation';
    return 'other';
  }

  private generateRecommendations(result: TestResult): string[] {
    const recommendations: string[] = [];

    // Energy recommendations
    if (!result.metrics.energyConvergence) {
      if (result.metrics.averageEnergy < 30) {
        recommendations.push('Energy levels are too low. Consider adjusting the replenishment rate or reducing energy consumption.');
      } else if (result.metrics.averageEnergy > 80) {
        recommendations.push('Energy levels remain very high. The model might not be engaging enough with tasks.');
      }
    }

    // Conversation handling recommendations
    if (result.metrics.conversationHandling === 'poor') {
      recommendations.push('Conversations are not being properly ended or snoozed. Review the conversation management logic.');
    }

    // Error recommendations
    if (result.errors.length > 0) {
      recommendations.push(`${result.errors.length} errors occurred during testing. Review error logs for details.`);
    }

    // Stability recommendations
    const analysis = this.analyzeResult(result);
    if (analysis.energyAnalysis.stabilityScore < 50) {
      recommendations.push('Energy levels are unstable. Consider implementing better energy management strategies.');
    }

    if (analysis.energyAnalysis.depletionEvents > 5) {
      recommendations.push('Frequent energy depletion detected. The model may need better energy conservation strategies.');
    }

    return recommendations;
  }

  async generateSummary(results: TestResult[]): Promise<void> {
    if (!this.config.testSettings.saveReports) return;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `summary_${timestamp}.json`;
    const filepath = path.join(this.reportDir, filename);

    const summary = {
      timestamp: new Date().toISOString(),
      totalScenarios: results.length,
      passed: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      successRate: (results.filter(r => r.success).length / results.length) * 100,
      scenarios: results.map(r => ({
        name: r.scenarioName,
        success: r.success,
        averageEnergy: r.metrics.averageEnergy,
        energyConvergence: r.metrics.energyConvergence,
        conversationHandling: r.metrics.conversationHandling,
        errors: r.errors.length
      })),
      overallMetrics: {
        averageEnergy: results.reduce((sum, r) => sum + r.metrics.averageEnergy, 0) / results.length,
        convergenceRate: (results.filter(r => r.metrics.energyConvergence).length / results.length) * 100,
        errorRate: (results.filter(r => r.errors.length > 0).length / results.length) * 100
      },
      recommendations: this.generateOverallRecommendations(results)
    };

    await fs.writeJson(filepath, summary, { spaces: 2 });
    
    // Also generate a markdown report
    const markdownPath = path.join(this.reportDir, `summary_${timestamp}.md`);
    await fs.writeFile(markdownPath, this.generateMarkdownSummary(summary));
    
    console.log(`\n📊 Summary report saved: ${filename}`);
    console.log(`📄 Markdown report saved: summary_${timestamp}.md`);
  }

  private generateOverallRecommendations(results: TestResult[]): string[] {
    const recommendations: string[] = [];

    const avgEnergy = results.reduce((sum, r) => sum + r.metrics.averageEnergy, 0) / results.length;
    const convergenceRate = (results.filter(r => r.metrics.energyConvergence).length / results.length) * 100;

    if (avgEnergy < 40) {
      recommendations.push('Overall energy levels are low across tests. Consider global energy management improvements.');
    }

    if (convergenceRate < 50) {
      recommendations.push('Energy convergence rate is low. The system needs better stability mechanisms.');
    }

    const poorHandling = results.filter(r => r.metrics.conversationHandling === 'poor').length;
    if (poorHandling > results.length / 2) {
      recommendations.push('Conversation handling needs improvement across multiple scenarios.');
    }

    return recommendations;
  }

  private generateMarkdownSummary(summary: any): string {
    let markdown = `# Test Summary Report\n\n`;
    markdown += `**Date:** ${summary.timestamp}\n\n`;
    markdown += `## Overall Results\n\n`;
    markdown += `- **Total Scenarios:** ${summary.totalScenarios}\n`;
    markdown += `- **Passed:** ${summary.passed}\n`;
    markdown += `- **Failed:** ${summary.failed}\n`;
    markdown += `- **Success Rate:** ${summary.successRate.toFixed(1)}%\n\n`;
    
    markdown += `## Scenario Results\n\n`;
    markdown += `| Scenario | Success | Avg Energy | Converged | Handling | Errors |\n`;
    markdown += `|----------|---------|------------|-----------|----------|--------|\n`;
    
    for (const scenario of summary.scenarios) {
      markdown += `| ${scenario.name} | ${scenario.success ? '✅' : '❌'} | ${scenario.averageEnergy.toFixed(1)}% | ${scenario.energyConvergence ? '✅' : '❌'} | ${scenario.conversationHandling} | ${scenario.errors} |\n`;
    }

    markdown += `\n## Overall Metrics\n\n`;
    markdown += `- **Average Energy:** ${summary.overallMetrics.averageEnergy.toFixed(1)}%\n`;
    markdown += `- **Convergence Rate:** ${summary.overallMetrics.convergenceRate.toFixed(1)}%\n`;
    markdown += `- **Error Rate:** ${summary.overallMetrics.errorRate.toFixed(1)}%\n\n`;

    if (summary.recommendations.length > 0) {
      markdown += `## Recommendations\n\n`;
      for (const rec of summary.recommendations) {
        markdown += `- ${rec}\n`;
      }
    }

    return markdown;
  }
}
