import { useMemo, useState } from 'react';
import { useInboundMessages, useMarkInboundProcessed } from '@/hooks/useWhatsAppMessages';
import { useOrders } from '@/hooks/useOrders';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { CustomerReplyBadge } from './CustomerReplyBadge';
import { formatPhoneForDisplay } from '@/lib/heyy/phone';
import { Inbox, CheckCircle2, Search, ExternalLink, Loader2 } from 'lucide-react';
import type { WhatsAppInbound } from '@/lib/heyy/types';

function timeAgo(iso: string): string {
  const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 60) return 'עכשיו';
  if (diffSec < 3600) return `לפני ${Math.floor(diffSec / 60)} דקות`;
  if (diffSec < 86400) return `לפני ${Math.floor(diffSec / 3600)} שעות`;
  return new Date(iso).toLocaleDateString('he-IL');
}

export function InboundMessagesPanel() {
  const { data: inbound, isLoading } = useInboundMessages();
  const { data: orders } = useOrders();
  const markProcessed = useMarkInboundProcessed();
  const [search, setSearch] = useState('');
  const [showProcessed, setShowProcessed] = useState(false);

  const ordersMap = useMemo(() => {
    const m = new Map<string, { customerName: string }>();
    (orders ?? []).forEach((o) => m.set(o.id, { customerName: o.customerName }));
    return m;
  }, [orders]);

  const filtered = useMemo(() => {
    const items = inbound ?? [];
    return items.filter((m) => {
      if (!showProcessed && m.status === 'processed') return false;
      if (search) {
        const q = search.toLowerCase();
        const text = (m.bodyText ?? '').toLowerCase();
        const phone = m.phoneE164 ?? '';
        const phoneLocal = m.phoneLocal ?? '';
        const customerName = m.orderId ? ordersMap.get(m.orderId)?.customerName ?? '' : '';
        if (
          !text.includes(q) &&
          !phone.includes(q) &&
          !phoneLocal.includes(q) &&
          !customerName.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [inbound, search, showProcessed, ordersMap]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Inbox className="h-4 w-4 text-emerald-600" />
          הודעות נכנסות
          {inbound && (
            <Badge variant="outline" className="text-xs">
              {filtered.length} / {inbound.length}
            </Badge>
          )}
        </CardTitle>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="חיפוש..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-48 ps-7"
            />
          </div>
          <Button
            variant={showProcessed ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowProcessed((v) => !v)}
          >
            {showProcessed ? 'הסתר טופלו' : 'הצג טופלו'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {(inbound?.length ?? 0) === 0
              ? 'אין הודעות נכנסות עדיין. במצב דמו — לחץ "סמלץ תשובת לקוח" משמאל כדי לבדוק.'
              : 'לא נמצאו הודעות לפי הסינון'}
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.map((msg) => (
              <InboundRow
                key={msg.id}
                msg={msg}
                customerName={msg.orderId ? ordersMap.get(msg.orderId)?.customerName : undefined}
                onMarkProcessed={() => markProcessed.mutate({ id: msg.id })}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function InboundRow({
  msg,
  customerName,
  onMarkProcessed,
}: {
  msg: WhatsAppInbound;
  customerName?: string;
  onMarkProcessed: () => void;
}) {
  const isProcessed = msg.status === 'processed';
  return (
    <li
      className={
        'rounded-lg border p-3 transition-colors ' +
        (isProcessed ? 'bg-muted/30 opacity-60' : 'bg-card hover:bg-muted/30')
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold">{customerName ?? 'לא ידוע'}</span>
            <span className="text-xs text-muted-foreground" dir="ltr">
              {formatPhoneForDisplay(msg.phoneE164)}
            </span>
            {msg.isDemo && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
                דמו
              </Badge>
            )}
            {msg.parsedReplyStatus && <CustomerReplyBadge status={msg.parsedReplyStatus} />}
            {!msg.orderId && (
              <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 text-[10px]">
                לא משויך להזמנה
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm whitespace-pre-wrap break-words">{msg.bodyText}</p>
          <div className="mt-1 text-xs text-muted-foreground">{timeAgo(msg.receivedAt)}</div>
        </div>
        <div className="flex flex-col gap-1">
          {!isProcessed && (
            <Button variant="ghost" size="sm" onClick={onMarkProcessed} title="סמן כטופל">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </Button>
          )}
          {msg.orderId && (
            <Button variant="ghost" size="sm" title="פתח הזמנה (טרם מיושם)">
              <ExternalLink className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}
