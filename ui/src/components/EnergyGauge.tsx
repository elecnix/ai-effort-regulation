import { Battery, BatteryLow, BatteryMedium, BatteryWarning } from 'lucide-react';

interface EnergyGaugeProps {
  current: number;
  max: number;
  min: number;
  status: 'high' | 'medium' | 'low' | 'urgent';
}

export function EnergyGauge({ current, max, status }: EnergyGaugeProps) {
  const percentage = Math.round(Math.min(100, Math.max(0, current)));
  
  const getColor = () => {
    if (status === 'high') return 'text-green-500';
    if (status === 'medium') return 'text-yellow-500';
    if (status === 'low') return 'text-orange-500';
    return 'text-red-500';
  };

  const getIcon = () => {
    if (status === 'high') return <Battery className="w-6 h-6" />;
    if (status === 'medium') return <BatteryMedium className="w-6 h-6" />;
    if (status === 'low') return <BatteryLow className="w-6 h-6" />;
    return <BatteryWarning className="w-6 h-6" />;
  };

  const getBgColor = () => {
    if (status === 'high') return 'bg-green-500';
    if (status === 'medium') return 'bg-yellow-500';
    if (status === 'low') return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div className="flex items-center gap-3">
      <div className={getColor()}>
        {getIcon()}
      </div>
      <div className="flex-1">
        <div className="flex justify-between text-sm mb-1">
          <span className="font-medium">Energy</span>
          <span className={getColor()}>{percentage}%</span>
        </div>
        <div className="h-2 bg-secondary rounded-full overflow-hidden">
          <div 
            className={`h-full ${getBgColor()} transition-all duration-300`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          {current.toFixed(0)} / {max}
        </div>
      </div>
    </div>
  );
}
