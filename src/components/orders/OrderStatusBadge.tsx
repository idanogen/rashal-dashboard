import { Badge } from '@/components/ui/badge';
import { getOrderStatusLabel, getOrderStatusColor } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface OrderStatusBadgeProps {
  status: string | undefined;
  className?: string;
}

const colorMap: Record<string, string> = {
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  purple: 'bg-purple-50 text-purple-700 border-purple-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  green: 'bg-green-50 text-green-700 border-green-200',
  gray: 'bg-gray-50 text-gray-500 border-gray-200',
};

export function OrderStatusBadge({ status, className }: OrderStatusBadgeProps) {
  const color = getOrderStatusColor(status);
  const label = getOrderStatusLabel(status);

  return (
    <Badge
      variant="outline"
      className={cn(
        'font-medium text-xs px-2 py-0.5',
        colorMap[color] || colorMap.gray,
        className
      )}
    >
      {label}
    </Badge>
  );
}
