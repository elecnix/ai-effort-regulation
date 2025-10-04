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
    console.log(`Energy consumed: ${amount}, current: ${this.energy}`);
  }

  replenishEnergy(seconds: number): void {
    const replenish = seconds * this.replenishRate;
    this.energy = Math.min(this.maxEnergy, this.energy + replenish);
    console.log(`Energy replenished: ${replenish}, current: ${this.energy}`);
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
