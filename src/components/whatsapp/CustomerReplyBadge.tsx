import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Check, X, Clock, MessageSquare } from 'lucide-react';
import type { CustomerReplyStatus } from '@/types/order';

const styles: Record<CustomerReplyStatus, { className: string; icon: typeof Check }> = {
  'מתאים':        { className: 'bg-green-50 text-green-700 border-green-200', icon: Check },
  'לא מתאים':     { className: 'bg-red-50 text-red-700 border-red-200',       icon: X },
  'בקשת שינוי':   { className: 'bg-amber-50 text-amber-700 border-amber-200', icon: MessageSquare },
  'ממתין':        { className: 'bg-gray-50 text-gray-500 border-gray-200',    icon: Clock },
};

interface CustomerReplyBadgeProps {
  status: CustomerReplyStatus | undefined;
  requestedTime?: string;
  className?: string;
}

export function CustomerReplyBadge({ status, requestedTime, className }: CustomerReplyBadgeProps) {
  if (!status) return null;
  const style = styles[status];
  const Icon = style.icon;
  return (
    <Badge
      variant="outline"
      title={requestedTime ?? undefined}
      className={cn('font-medium text-xs px-2 py-0.5 inline-flex items-center gap-1', style.className, className)}
    >
      <Icon className="h-3 w-3" />
      <span>{status}</span>
      {status === 'בקשת שינוי' && requestedTime && (
        <span className="text-[10px] opacity-70 max-w-[120px] truncate">— {requestedTime}</span>
      )}
    </Badge>
  );
}
