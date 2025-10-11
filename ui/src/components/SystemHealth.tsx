import { Activity, MessageSquare, Clock, Cpu } from 'lucide-react';
import { EnergyGauge } from './EnergyGauge';
import { SystemStats } from '../types/websocket';

interface SystemHealthProps {
  stats: SystemStats | null;
  energy: {
    current: number;
    max: number;
    min: number;
    status: 'high' | 'medium' | 'low' | 'urgent';
  };
}

export function SystemHealth({ stats, energy }: SystemHealthProps) {
  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours}h ${minutes}m ${secs}s`;
  };

  return (
    <div className="bg-card border-b border-border p-4">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <EnergyGauge {...energy} />
          </div>
          
          <div className="flex items-center gap-3">
            <MessageSquare className="w-5 h-5 text-blue-500" />
            <div>
              <div className="text-sm text-muted-foreground">Conversations</div>
              <div className="text-lg font-semibold">
                {stats?.totalConversations || 0}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-purple-500" />
            <div>
              <div className="text-sm text-muted-foreground">Responses</div>
              <div className="text-lg font-semibold">
                {stats?.totalResponses || 0}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Uptime:</span>
            <span className="font-medium">{stats ? formatUptime(stats.uptime) : '0s'}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Avg Energy:</span>
            <span className="font-medium">{stats?.avgEnergyLevel?.toFixed(0) || 0}%</span>
          </div>

          {stats?.modelSwitches !== undefined && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Model Switches:</span>
              <span className="font-medium">{stats.modelSwitches}</span>
            </div>
          )}

          {stats?.sleepCycles !== undefined && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Sleep Cycles:</span>
              <span className="font-medium">{stats.sleepCycles}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
