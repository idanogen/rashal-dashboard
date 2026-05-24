import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { MessageCircle, Phone, Check, X, MessageSquare } from 'lucide-react';
import type { CoordinationStatus } from '@/types/calendar-stop';

const styles: Record<
  CoordinationStatus,
  { className: string; icon: typeof Check; label: string }
> = {
  whatsapp_sent:      { className: 'bg-blue-50 text-blue-700 border-blue-200',     icon: MessageCircle,   label: 'WA נשלח' },
  phone_confirmed:    { className: 'bg-purple-50 text-purple-700 border-purple-200', icon: Phone,         label: 'תואם טלפונית' },
  customer_confirmed: { className: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: Check,      label: 'הלקוח אישר' },
  customer_rejected:  { className: 'bg-red-50 text-red-700 border-red-200',         icon: X,              label: 'הלקוח דחה' },
  customer_change:    { className: 'bg-amber-50 text-amber-700 border-amber-200',   icon: MessageSquare,  label: 'הלקוח ביקש שינוי' },
};

interface CoordinationStatusBadgeProps {
  status: CoordinationStatus | undefined;
  className?: string;
  showLabel?: boolean;
}

export function CoordinationStatusBadge({ status, className, showLabel = true }: CoordinationStatusBadgeProps) {
  if (!status) return null;
  const style = styles[status];
  const Icon = style.icon;
  return (
    <Badge
      variant="outline"
      className={cn('font-medium px-1.5 py-0 inline-flex items-center gap-1', style.className, className)}
    >
      <Icon className="h-2.5 w-2.5" />
      {showLabel && <span>{style.label}</span>}
    </Badge>
  );
}
