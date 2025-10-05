export class EnergyRegulator {
  private energy: number = 100; // Start fully rested
  private readonly maxEnergy: number = 100;
  private readonly minEnergy: number = -50; // Allow negative for urgent situations
  private readonly replenishRate: number;

  // Track energy consumption events for load average calculation
  private energyConsumptionEvents: Array<{ timestamp: number; amount: number }> = [];

  constructor(replenishRate: number = 1) {
    this.replenishRate = replenishRate;
  }

  getEnergy(): number {
    return this.energy;
  }

  getEnergyPercentage(): number {
    return Math.round(Math.min(100, Math.max(0, this.energy)));
  }

  consumeEnergy(amount: number): void {
    this.energy = Math.round(Math.max(this.minEnergy, this.energy - amount));

    // Record the consumption event for load average calculation
    this.energyConsumptionEvents.push({
      timestamp: Date.now(),
      amount: amount
    });

    // Keep only the last 24 hours of events (15 minutes * 4 = 1 hour, but keep more for safety)
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    this.energyConsumptionEvents = this.energyConsumptionEvents.filter(event => event.timestamp > oneDayAgo);
  }

  async sleep(seconds: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, seconds * 1000));
    this.energy = Math.round(Math.min(this.maxEnergy, this.energy + (seconds * this.replenishRate)));
  }

  isDepleted(): boolean {
    return this.energy <= 0;
  }

  isUrgent(): boolean {
    return this.energy < 0;
  }

  async awaitEnergyLevel(needed: number): Promise<boolean> {
    let effectiveTarget = this.energy < -50 ? this.maxEnergy : needed;
    if (this.energy >= effectiveTarget) {
      return true;
    }
    const deficit = effectiveTarget - this.energy;
    const sleepTime = Math.ceil(deficit / this.replenishRate);
    if (this.energy < -50) {
      console.log(`⚠️ Critical energy (${this.energy}) - forced recovery sleep to 100%`);
      effectiveTarget = this.maxEnergy;
    }
    console.log(`💤 Awaiting ${effectiveTarget}% energy`);
    await this.sleep(sleepTime);
    return true;
  }

  getStatus(): string {
    if (this.energy > 50) return 'high';
    if (this.energy > 20) return 'medium';
    if (this.energy > 0) return 'low';
    return 'urgent';
  }

  /**
   * Calculate energy expenditure load averages (similar to Linux load averages)
   * Returns the average energy consumed per minute over 1min, 5min, and 15min windows
   */
  getEnergyLoadAverages(): { '1min': number; '5min': number; '15min': number } {
    const now = Date.now();

    // Calculate total energy consumed in each time window
    const calculateAverage = (minutes: number): number => {
      const windowStart = now - (minutes * 60 * 1000);
      const eventsInWindow = this.energyConsumptionEvents.filter(event => event.timestamp >= windowStart);
      const totalEnergy = eventsInWindow.reduce((sum, event) => sum + event.amount, 0);
      const averagePerMinute = totalEnergy / minutes;
      return Math.round(averagePerMinute * 10) / 10; // Round to 1 decimal place
    };

    return {
      '1min': calculateAverage(1),
      '5min': calculateAverage(5),
      '15min': calculateAverage(15)
    };
  }
}
