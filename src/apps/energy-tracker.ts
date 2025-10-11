import Database from 'better-sqlite3';
import { CircularBuffer } from './circular-buffer';
import { AppEnergyMetrics, EnergyEvent } from './types';

export class AppEnergyTracker {
  private cache: Map<string, CircularBuffer<EnergyEvent>> = new Map();
  private insertStmt: Database.Statement;
  
  constructor(private db: Database.Database) {
    this.insertStmt = db.prepare(`
      INSERT INTO app_energy (app_id, timestamp, energy_consumed, conversation_id, operation)
      VALUES (?, datetime(?), ?, ?, ?)
    `);
  }
  
  record(appId: string, amount: number, conversationId?: string, operation?: string): void {
    const event: EnergyEvent = {
      timestamp: Date.now(),
      amount,
      ...(conversationId !== undefined && { conversationId }),
      ...(operation !== undefined && { operation })
    };
    
    if (!this.cache.has(appId)) {
      this.cache.set(appId, new CircularBuffer<EnergyEvent>(1000));
    }
    this.cache.get(appId)!.push(event);
    
    setImmediate(() => {
      try {
        this.insertStmt.run(
          appId,
          new Date(event.timestamp).toISOString(),
          amount,
          conversationId || null,
          operation || null
        );
      } catch (error) {
        console.error(`Error persisting energy event for ${appId}:`, error);
      }
    });
  }
  
  getMetrics(appId: string): AppEnergyMetrics {
    const events = this.cache.get(appId);
    if (!events) {
      return this.getMetricsFromDatabase(appId);
    }
    
    const now = Date.now();
    const oneMin = now - 60 * 1000;
    const oneHour = now - 60 * 60 * 1000;
    const oneDay = now - 24 * 60 * 60 * 1000;
    
    let total = 0;
    let last24h = 0;
    let last1h = 0;
    let last1min = 0;
    
    for (const event of events.items()) {
      total += event.amount;
      if (event.timestamp > oneDay) last24h += event.amount;
      if (event.timestamp > oneHour) last1h += event.amount;
      if (event.timestamp > oneMin) last1min += event.amount;
    }
    
    return { total, last24h, last1h, last1min };
  }
  
  private getMetricsFromDatabase(appId: string): AppEnergyMetrics {
    try {
      const totalStmt = this.db.prepare(`
        SELECT COALESCE(SUM(energy_consumed), 0) as total
        FROM app_energy
        WHERE app_id = ?
      `);
      const totalResult = totalStmt.get(appId) as { total: number };
      
      const last24hStmt = this.db.prepare(`
        SELECT COALESCE(SUM(energy_consumed), 0) as total
        FROM app_energy
        WHERE app_id = ? AND timestamp > datetime('now', '-24 hours')
      `);
      const last24hResult = last24hStmt.get(appId) as { total: number };
      
      const last1hStmt = this.db.prepare(`
        SELECT COALESCE(SUM(energy_consumed), 0) as total
        FROM app_energy
        WHERE app_id = ? AND timestamp > datetime('now', '-1 hour')
      `);
      const last1hResult = last1hStmt.get(appId) as { total: number };
      
      const last1minStmt = this.db.prepare(`
        SELECT COALESCE(SUM(energy_consumed), 0) as total
        FROM app_energy
        WHERE app_id = ? AND timestamp > datetime('now', '-1 minute')
      `);
      const last1minResult = last1minStmt.get(appId) as { total: number };
      
      return {
        total: totalResult.total,
        last24h: last24hResult.total,
        last1h: last1hResult.total,
        last1min: last1minResult.total
      };
    } catch (error) {
      console.error(`Error getting metrics from database for ${appId}:`, error);
      return { total: 0, last24h: 0, last1h: 0, last1min: 0 };
    }
  }
  
  getMetricsForTimeRange(appId: string, start: Date, end: Date): number {
    try {
      const stmt = this.db.prepare(`
        SELECT COALESCE(SUM(energy_consumed), 0) as total
        FROM app_energy
        WHERE app_id = ? AND timestamp BETWEEN datetime(?) AND datetime(?)
      `);
      const result = stmt.get(appId, start.toISOString(), end.toISOString()) as { total: number };
      return result.total;
    } catch (error) {
      console.error(`Error getting time range metrics for ${appId}:`, error);
      return 0;
    }
  }
  
  clearCache(appId?: string): void {
    if (appId) {
      this.cache.delete(appId);
    } else {
      this.cache.clear();
    }
  }
}
