import { ReactNode } from 'react';

interface MetricCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
}

export function MetricCard({ label, value, subtitle, icon }: MetricCardProps) {
  return (
    <div className="metric-card">
      <div className="flex items-center justify-between mb-2 md:mb-3">
        <span className="text-xs md:text-sm text-muted-foreground leading-tight">{label}</span>
        {icon && <span className="text-primary/60">{icon}</span>}
      </div>
      <p className="text-lg md:text-2xl font-semibold text-foreground">{value}</p>
      {subtitle && <p className="text-[10px] md:text-xs text-muted-foreground mt-1">{subtitle}</p>}
    </div>
  );
}
