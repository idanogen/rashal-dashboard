import { useMemo } from 'react';
import { useOutboundMessages } from '@/hooks/useWhatsAppMessages';
import { useOrders } from '@/hooks/useOrders';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Send, Loader2 } from 'lucide-react';
import { formatPhoneForDisplay } from '@/lib/heyy/phone';
import { getTemplate } from '@/lib/heyy/templates';
import type { WhatsAppOutbound, WhatsAppOutboundStatus } from '@/lib/heyy/types';

const statusStyles: Record<WhatsAppOutboundStatus, string> = {
  pending:   'bg-gray-100 text-gray-700',
  sent:      'bg-blue-100 text-blue-700',
  delivered: 'bg-green-100 text-green-700',
  read:      'bg-green-200 text-green-800',
  failed:    'bg-red-100 text-red-700',
};

function statusLabel(s: WhatsAppOutboundStatus): string {
  return ({ pending: 'ממתין', sent: 'נשלח', delivered: 'נמסר', read: 'נקרא', failed: 'נכשל' } as const)[s];
}

function timeAgo(iso: string): string {
  const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 60) return 'עכשיו';
  if (diffSec < 3600) return `לפני ${Math.floor(diffSec / 60)} דק'`;
  if (diffSec < 86400) return `לפני ${Math.floor(diffSec / 3600)} שע'`;
  return new Date(iso).toLocaleString('he-IL');
}

export function OutboundLog() {
  const { data: outbound, isLoading } = useOutboundMessages();
  const { data: orders } = useOrders();

  const ordersMap = useMemo(() => {
    const m = new Map<string, string>();
    (orders ?? []).forEach((o) => m.set(o.id, o.customerName));
    return m;
  }, [orders]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Send className="h-4 w-4 text-blue-600" />
          הודעות יוצאות
          {outbound && (
            <Badge variant="outline" className="text-xs">
              {outbound.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (outbound ?? []).length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">לא נשלחו עדיין הודעות</div>
        ) : (
          <ul className="space-y-2">
            {(outbound ?? []).map((row) => (
              <OutboundRow key={row.id} row={row} customerName={row.orderId ? ordersMap.get(row.orderId) : undefined} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function OutboundRow({ row, customerName }: { row: WhatsAppOutbound; customerName?: string }) {
  const tplLabel = row.reminderKind ? getTemplate(row.reminderKind).label : (row.messageKind === 'text' ? 'הודעת טקסט' : 'תבנית');
  return (
    <li className="rounded-lg border p-3 bg-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold">{customerName ?? 'ללא הזמנה'}</span>
            <span className="text-xs text-muted-foreground" dir="ltr">
              {formatPhoneForDisplay(row.phoneE164)}
            </span>
            <Badge variant="outline" className="text-[10px]">{tplLabel}</Badge>
            <Badge variant="outline" className={`text-[10px] ${statusStyles[row.status]}`}>
              {statusLabel(row.status)}
            </Badge>
            {row.isDemo && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
                דמו
              </Badge>
            )}
          </div>
          {row.bodyText && <p className="mt-1 text-sm whitespace-pre-wrap break-words">{row.bodyText}</p>}
          {row.templateParams && row.templateParams.length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              params: [{row.templateParams.join(', ')}]
            </p>
          )}
          {row.statusDetail && (
            <p className="mt-1 text-xs text-muted-foreground italic">{row.statusDetail}</p>
          )}
          <div className="mt-1 text-xs text-muted-foreground">
            {timeAgo(row.sentAt)} • {row.triggeredBy ?? '—'}
          </div>
        </div>
      </div>
    </li>
  );
}
