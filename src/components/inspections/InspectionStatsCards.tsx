import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, AlertTriangle, AlertCircle, HelpCircle } from 'lucide-react';

interface InspectionStatsCardsProps {
  totalActive: number;
  overdue: number;
  dueSoon: number;
  unknown: number;
}

export function InspectionStatsCards({
  totalActive,
  overdue,
  dueSoon,
  unknown,
}: InspectionStatsCardsProps) {
  const cards = [
    {
      title: 'מנופים פעילים',
      value: totalActive,
      icon: CheckCircle2,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      title: 'פג תוקף',
      value: overdue,
      icon: AlertCircle,
      color: 'text-red-600',
      bg: 'bg-red-50',
    },
    {
      title: 'בחודשיים הקרובים',
      value: dueSoon,
      icon: AlertTriangle,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      title: 'ללא תאריך התקנה',
      value: unknown,
      icon: HelpCircle,
      color: 'text-slate-500',
      bg: 'bg-slate-100',
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
              <p className="text-2xl font-bold leading-tight">{card.value.toLocaleString('he-IL')}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
