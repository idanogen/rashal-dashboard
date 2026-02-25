import { Wrench, Clock, CheckCircle2, Phone } from 'lucide-react';

interface ServiceCallStatusBarProps {
  pendingCount: number;
  scheduledCount: number;
  completedCount: number;
}

export function ServiceCallStatusBar({
  pendingCount,
  scheduledCount,
  completedCount,
}: ServiceCallStatusBarProps) {
  const items = [
    {
      label: 'קריאות חדשות',
      value: pendingCount,
      icon: Clock,
      color: 'text-blue-500',
      dotColor: 'bg-blue-500',
    },
    {
      label: 'תואם ביקור',
      value: scheduledCount,
      icon: Phone,
      color: 'text-purple-500',
      dotColor: 'bg-purple-500',
    },
    {
      label: 'בוצעו',
      value: completedCount,
      icon: CheckCircle2,
      color: 'text-green-500',
      dotColor: 'bg-green-500',
    },
  ];

  return (
    <div className="flex items-center justify-end gap-6 rounded-lg border bg-card px-4 py-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Wrench className="h-4 w-4" />
        <span>סטטוס קריאות שירות</span>
      </div>
      <div className="h-4 w-px bg-border" />
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2 text-sm">
          <span className={`h-2 w-2 rounded-full ${item.dotColor}`} />
          <span className="font-bold">{item.value}</span>
          <span className="text-muted-foreground">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
