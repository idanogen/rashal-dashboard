import { Truck, Clock, CheckCircle2, Package } from 'lucide-react';

interface DeliveryStatusBarProps {
  waitingCount: number;
  scheduledCount: number;
  deliveredThisWeek: number;
}

export function DeliveryStatusBar({
  waitingCount,
  scheduledCount,
  deliveredThisWeek,
}: DeliveryStatusBarProps) {
  const items = [
    {
      label: 'ממתינות לתיאום',
      value: waitingCount,
      icon: Clock,
      color: 'text-amber-500',
      dotColor: 'bg-amber-500',
    },
    {
      label: 'תואמה אספקה',
      value: scheduledCount,
      icon: Truck,
      color: 'text-blue-500',
      dotColor: 'bg-blue-500',
    },
    {
      label: 'סופקו השבוע',
      value: deliveredThisWeek,
      icon: CheckCircle2,
      color: 'text-green-500',
      dotColor: 'bg-green-500',
    },
  ];

  return (
    <div className="flex items-center justify-end gap-6 rounded-lg border bg-card px-4 py-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Package className="h-4 w-4" />
        <span>סטטוס משלוחים</span>
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
