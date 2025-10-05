export class EnergyRegulator {
  private energy: number = 100; // Start fully rested
  private readonly maxEnergy: number = 100;
  private readonly minEnergy: number = -50; // Allow negative for urgent situations
  private readonly replenishRate: number;

  constructor(replenishRate: number = 1) {
    this.replenishRate = replenishRate;
  }

  getEnergy(): number {
    return this.energy;
  }

  getEnergyPercentage(): number {
    return Math.round(Math.max(0, this.energy));
  }

  consumeEnergy(amount: number): void {
    this.energy = Math.max(this.minEnergy, this.energy - amount);
  }

  async sleep(seconds: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, seconds * 1000));
    this.energy = Math.min(this.maxEnergy, this.energy + (seconds * this.replenishRate));
  }

  isDepleted(): boolean {
    return this.energy <= 0;
  }

  isUrgent(): boolean {
    return this.energy < 0;
  }

  async awaitEnergyLevel(needed: number): Promise<boolean> {
    const effectiveTarget = this.energy < -50 ? this.maxEnergy : needed;
    if (this.energy < effectiveTarget) {
      const deficit = effectiveTarget - this.energy;
      const sleepTime = Math.ceil(deficit / this.replenishRate);
      if (this.energy < -50) {
        console.log(`⚠️ Critical energy (${this.energy}) - forced recovery sleep to 100%`);
      }
      await this.sleep(sleepTime);
      return true;
    }
    return false;
  }

  getStatus(): string {
    if (this.energy > 50) return 'high';
    if (this.energy > 20) return 'medium';
    if (this.energy > 0) return 'low';
    return 'urgent';
  }
}
