import { Card, CardContent } from '@/components/ui/card';
import { Clock, Phone, CheckCircle2 } from 'lucide-react';

interface ServiceCallStatsCardsProps {
  pending: number;
  scheduled: number;
  completed: number;
}

export function ServiceCallStatsCards({ pending, scheduled, completed }: ServiceCallStatsCardsProps) {
  const cards = [
    {
      title: 'קריאות חדשות',
      value: pending,
      icon: Clock,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      title: 'תואם ביקור',
      value: scheduled,
      icon: Phone,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      title: 'בוצעו',
      value: completed,
      icon: CheckCircle2,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
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
