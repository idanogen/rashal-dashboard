import { Card, CardContent } from '@/components/ui/card';
import { ClipboardList, Clock, PackageX, PackageCheck } from 'lucide-react';
import type { OrderStats } from '@/types/order';

interface StatsCardsProps {
  stats: OrderStats;
}

export function StatsCards({ stats }: StatsCardsProps) {
  const cards = [
    {
      title: 'סה"כ פתוחות',
      value: stats.total - stats.byOrderStatus.delivered,
      icon: ClipboardList,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      title: 'ממתין לתאום',
      value: stats.byOrderStatus.waiting,
      icon: Clock,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      title: 'אין במלאי',
      value: stats.byOrderStatus.outOfStock,
      icon: PackageX,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      title: 'סופקו השבוע',
      value: stats.thisWeekDelivered,
      icon: PackageCheck,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
      {cards.map((card) => (
        <Card key={card.title} className="border shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${card.bg}`}>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">{card.title}</p>
              <p className="text-2xl font-bold leading-tight">{card.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
