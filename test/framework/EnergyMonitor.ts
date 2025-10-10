import { TestClient } from './TestClient';
import { TestConfig, EnergyDataPoint } from './types';

export class EnergyMonitor {
  private client: TestClient;
  private config: TestConfig;
  private monitoring: boolean = false;
  private energyData: EnergyDataPoint[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor(client: TestClient, config: TestConfig) {
    this.client = client;
    this.config = config;
  }

  startMonitoring(): void {
    if (this.monitoring) {
      console.warn('Energy monitoring already started');
      return;
    }

    this.monitoring = true;
    this.energyData = [];

    // Sample energy at regular intervals
    this.monitoringInterval = setInterval(async () => {
      if (!this.monitoring) return;

      try {
        const energyLevel = await this.client.getEnergyLevel();
        const status = this.getEnergyStatus(energyLevel);
        
        this.energyData.push({
          timestamp: new Date(),
          energyLevel,
          status
        });

        if (this.config.testSettings.verbose) {
          console.log(`     📊 Energy: ${energyLevel}% (${status})`);
        }
      } catch (error) {
        console.error('Error monitoring energy:', error);
      }
    }, this.config.testSettings.energySampleInterval * 1000);
  }

  stopMonitoring(): EnergyDataPoint[] {
    this.monitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    return this.energyData;
  }

  private getEnergyStatus(energy: number): string {
    if (energy > 50) return 'high';
    if (energy > 20) return 'medium';
    if (energy > 0) return 'low';
    return 'urgent';
  }

  getEnergyData(): EnergyDataPoint[] {
    return [...this.energyData];
  }

  getAverageEnergy(): number {
    if (this.energyData.length === 0) return 0;
    
    const sum = this.energyData.reduce((acc, data) => acc + data.energyLevel, 0);
    return sum / this.energyData.length;
  }

  getEnergyTrend(): 'stable' | 'declining' | 'recovering' | 'unknown' {
    if (this.energyData.length < 3) return 'unknown';

    // Look at the last few data points
    const recentData = this.energyData.slice(-5);
    const firstPoint = recentData[0];
    const lastPoint = recentData[recentData.length - 1];
    
    if (!firstPoint || !lastPoint) return 'unknown';
    
    const firstEnergy = firstPoint.energyLevel;
    const lastEnergy = lastPoint.energyLevel;
    const difference = lastEnergy - firstEnergy;

    if (Math.abs(difference) < 10) {
      return 'stable';
    } else if (difference > 10) {
      return 'recovering';
    } else {
      return 'declining';
    }
  }

  isEnergyConverged(): boolean {
    if (this.energyData.length < 10) return false;

    // Check if recent energy levels are stable and operational (not stuck at 0)
    const recentData = this.energyData.slice(-10);
    const avgEnergy = recentData.reduce((sum, d) => sum + d.energyLevel, 0) / recentData.length;
    
    // System is converged if it's operational (above minimum) and not wildly fluctuating
    const { minAcceptable } = this.config.energyTargets;
    const isOperational = avgEnergy >= minAcceptable;
    const variance = this.getEnergyVariance();
    const isStable = variance < 30; // Not wildly fluctuating
    
    return isOperational && isStable;
  }

  getEnergyVariance(): number {
    if (this.energyData.length < 2) return 0;

    const recentData = this.energyData.slice(-10);
    const avg = recentData.reduce((sum, d) => sum + d.energyLevel, 0) / recentData.length;
    
    const variance = recentData.reduce((sum, d) => {
      const diff = d.energyLevel - avg;
      return sum + (diff * diff);
    }, 0) / recentData.length;

    return Math.sqrt(variance);
  }

  detectEnergyDepletion(): boolean {
    if (this.energyData.length < 5) return false;

    // Check if energy has been consistently low
    const recentData = this.energyData.slice(-5);
    const lowEnergyCount = recentData.filter(d => d.energyLevel < 20).length;
    
    return lowEnergyCount >= 3;
  }
}
