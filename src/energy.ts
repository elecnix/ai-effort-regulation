export class EnergyRegulator {
  private energy: number = 100; // Start fully rested
  private readonly maxEnergy: number = 100;
  private readonly minEnergy: number = -50; // Allow negative for urgent situations
  private readonly replenishRate: number = 10; // Units per second during sleep (matches spec)

  getEnergy(): number {
    return this.energy;
  }

  consumeEnergy(amount: number): void {
    this.energy = Math.max(this.minEnergy, this.energy - amount);
    console.log(`⚡ Energy consumed: ${amount}, current: ${this.energy} (${this.getStatus()})`);
  }

  replenishEnergy(seconds: number): void {
    const oldEnergy = this.energy;
    this.energy = Math.min(this.maxEnergy, this.energy + (seconds * this.replenishRate));

    // Only log significant changes or when energy was low
    if (oldEnergy < 80 || this.energy !== oldEnergy) {
      console.log(`🔋 Energy: ${oldEnergy} → ${this.energy} (${this.getStatus()})`);
    }
  }

  isDepleted(): boolean {
    return this.energy <= 0;
  }

  isUrgent(): boolean {
    return this.energy < 0;
  }

  getStatus(): string {
    if (this.energy > 50) return 'high';
    if (this.energy > 20) return 'medium';
    if (this.energy > 0) return 'low';
    return 'urgent';
  }
}
