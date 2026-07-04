import { useState } from 'react';
import { History, Package, Wrench, Loader2, MessageSquare, Image as ImageIcon } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { OrderChatSheet } from '@/components/OrderChatSheet';

// היסטוריית לקוח (עמי #3): כל ההזמנות וקריאות השירות של אותו לקוח,
// כדי שטכנאי/מתאם יראה מה כבר נעשה אצלו לפני שיוצאים אליו.

export interface HistoryCustomerRef {
  /** מזהה הרשומה הנוכחית — כדי לסמן אותה ברשימה */
  currentId: string;
  customerNumber?: string;
  customerName: string;
}

interface HistoryEntry {
  id: string;
  kind: 'order' | 'service';
  created: string;
  status: string | null;
  city: string | null;
  summary: string | null; // ציוד (הזמנה) / מכשיר+תקלה (קריאה)
  msgCount: number; // הודעות בצ'אט של אנשי השטח
  photos: string[]; // תצוגות מקדימות של תמונות מהשיחה
}

// שולף את פעילות הצ'אט (הודעות + תמונות) לכל הרשומות בהיסטוריה בבת-אחת (עמי)
async function attachChat(entries: HistoryEntry[]): Promise<void> {
  const orderIds = entries.filter((e) => e.kind === 'order').map((e) => e.id);
  const callIds = entries.filter((e) => e.kind === 'service').map((e) => e.id);
  const byId = new Map(entries.map((e) => [e.id, e]));

  const ingest = (rows: Record<string, unknown>[] | null) => {
    for (const r of rows ?? []) {
      const rid = (r.order_id as string) ?? (r.service_call_id as string);
      const e = byId.get(rid);
      if (!e) continue;
      if (r.type === 'comment') e.msgCount++;
      const meta = r.metadata as { imageUrls?: string[] } | null;
      if (meta?.imageUrls?.length) e.photos.push(...meta.imageUrls);
    }
  };

  const q: PromiseLike<unknown>[] = [];
  if (orderIds.length)
    q.push(
      supabase.from('timeline_events').select('order_id, type, metadata')
        .in('order_id', orderIds).then(({ data }) => ingest(data))
    );
  if (callIds.length)
    q.push(
      supabase.from('timeline_events').select('service_call_id, type, metadata')
        .in('service_call_id', callIds).then(({ data }) => ingest(data))
    );
  await Promise.all(q);
}

async function fetchHistory(ref: HistoryCustomerRef): Promise<HistoryEntry[]> {
  // חיפוש לפי מספר לקוח (מדויק) + לפי שם (fallback לשורות ישנות בלי מספר).
  // שתי שאילתות נפרדות לכל טבלה — סינטקס or() של PostgREST נשבר על גרשיים בשמות.
  const seen = new Set<string>();
  const entries: HistoryEntry[] = [];

  const collectOrders = (rows: Record<string, unknown>[] | null) => {
    for (const r of rows ?? []) {
      const id = r.id as string;
      if (seen.has('o' + id)) continue;
      seen.add('o' + id);
      const items = (r.items as { desc?: string; qty?: number }[] | null) ?? null;
      entries.push({
        id,
        kind: 'order',
        created: r.created_at as string,
        status: (r.order_status as string) ?? null,
        city: (r.city as string) ?? null,
        summary: items?.length
          ? `${items[0].desc ?? ''}${items.length > 1 ? ` +${items.length - 1}` : ''}`
          : null,
        msgCount: 0,
        photos: [],
      });
    }
  };
  const collectCalls = (rows: Record<string, unknown>[] | null) => {
    for (const r of rows ?? []) {
      const id = r.id as string;
      if (seen.has('s' + id)) continue;
      seen.add('s' + id);
      const device = (r.device_name as string) ?? null;
      const fault = (r.fault_desc as string) ?? (r.symptom_desc as string) ?? null;
      entries.push({
        id,
        kind: 'service',
        created: r.created_at as string,
        status: (r.service_call_status as string) ?? null,
        city: (r.city as string) ?? null,
        summary: [device, fault].filter(Boolean).join(' · ') || null,
        msgCount: 0,
        photos: [],
      });
    }
  };

  const ORDER_COLS = 'id, created_at, order_status, city, items';
  const CALL_COLS = 'id, created_at, service_call_status, city, device_name, fault_desc, symptom_desc';

  const queries: PromiseLike<unknown>[] = [];
  if (ref.customerNumber) {
    queries.push(
      supabase.from('orders').select(ORDER_COLS)
        .eq('customer_number', ref.customerNumber)
        .is('duplicate_of', null)
        .order('created_at', { ascending: false }).limit(50)
        .then(({ data }) => collectOrders(data)),
      supabase.from('service_calls').select(CALL_COLS)
        .eq('customer_number', ref.customerNumber)
        .is('duplicate_of', null)
        .order('created_at', { ascending: false }).limit(50)
        .then(({ data }) => collectCalls(data)),
    );
  }
  queries.push(
    supabase.from('orders').select(ORDER_COLS)
      .eq('customer_name', ref.customerName)
      .is('duplicate_of', null)
      .order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => collectOrders(data)),
    supabase.from('service_calls').select(CALL_COLS)
      .eq('customer_name', ref.customerName)
      .is('duplicate_of', null)
      .order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => collectCalls(data)),
  );
  await Promise.all(queries);

  entries.sort((a, b) => (a.created < b.created ? 1 : -1));
  await attachChat(entries);
  return entries;
}

const STATUS_COLORS: Record<string, string> = {
  'סופק': 'bg-green-100 text-green-800',
  'בוצע': 'bg-green-100 text-green-800',
  'תואמה אספקה': 'bg-blue-100 text-blue-800',
  'תואם ביקור': 'bg-blue-100 text-blue-800',
  'ממתין לתאום': 'bg-amber-100 text-amber-800',
  'קריאה חדשה': 'bg-amber-100 text-amber-800',
  'אין במלאי': 'bg-red-100 text-red-800',
  'בוטל': 'bg-gray-100 text-gray-600',
};

export function CustomerHistoryButton({
  customer,
  size = 'sm',
  className = '',
}: {
  customer: HistoryCustomerRef;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  // כשלוחצים על רשומה בהיסטוריה — נפתחת השיחה המלאה שלה
  const [chatFor, setChatFor] = useState<HistoryEntry | null>(null);

  const { data: entries, isLoading } = useQuery({
    queryKey: ['customer-history', customer.customerNumber ?? customer.customerName],
    queryFn: () => fetchHistory(customer),
    enabled: open,
    staleTime: 60_000,
  });

  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const btnSize = size === 'sm' ? 'h-7 w-7' : 'h-8 w-8';
  const pastCount = entries ? entries.length - 1 : 0; // בלי הרשומה הנוכחית

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen(true);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className={`${btnSize} inline-flex items-center justify-center rounded-lg transition-colors text-muted-foreground hover:text-primary hover:bg-primary/10 ${className}`}
        title="היסטוריית לקוח"
      >
        <History className={iconSize} />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-full sm:max-w-lg p-0 flex flex-col" dir="rtl">
          <SheetHeader className="p-4 border-b border-border/40 bg-muted/20">
            <SheetTitle className="text-base">
              היסטוריית לקוח — {customer.customerName}
              {customer.customerNumber && (
                <span className="ms-2 text-xs font-normal text-muted-foreground" dir="ltr">
                  {customer.customerNumber}
                </span>
              )}
            </SheetTitle>
            {entries && (
              <p className="text-xs text-muted-foreground">
                {pastCount > 0 ? `${pastCount} רשומות קודמות` : 'אין רשומות קודמות ללקוח זה'}
              </p>
            )}
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {isLoading && (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            )}
            {entries?.map((e) => {
              const isCurrent = e.id === customer.currentId;
              const hasChat = e.msgCount > 0 || e.photos.length > 0;
              return (
                <button
                  key={e.kind + e.id}
                  type="button"
                  onClick={() => setChatFor(e)}
                  className={`w-full text-start rounded-lg border p-2.5 text-sm transition-colors hover:border-primary/50 hover:bg-primary/5 ${
                    isCurrent ? 'border-primary/50 bg-primary/5' : 'border-border/60 bg-card'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 font-medium">
                      {e.kind === 'order' ? (
                        <Package className="h-3.5 w-3.5 text-blue-600" />
                      ) : (
                        <Wrench className="h-3.5 w-3.5 text-orange-600" />
                      )}
                      {e.kind === 'order' ? 'הזמנה' : 'קריאת שירות'}
                      {isCurrent && (
                        <span className="text-[10px] font-normal text-primary">(הנוכחית)</span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground" dir="ltr">
                      {new Date(e.created).toLocaleDateString('he-IL')}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    {e.status && (
                      <Badge
                        variant="outline"
                        className={`text-[10px] border-0 ${STATUS_COLORS[e.status] ?? 'bg-gray-100 text-gray-700'}`}
                      >
                        {e.status}
                      </Badge>
                    )}
                    {e.city && <span className="text-xs text-muted-foreground">{e.city}</span>}
                    {e.msgCount > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground">
                        <MessageSquare className="h-3 w-3" />
                        {e.msgCount}
                      </span>
                    )}
                    {e.photos.length > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground">
                        <ImageIcon className="h-3 w-3" />
                        {e.photos.length}
                      </span>
                    )}
                  </div>
                  {e.summary && (
                    <p className="mt-1 text-xs text-muted-foreground truncate" title={e.summary}>
                      {e.summary}
                    </p>
                  )}
                  {/* תצוגות מקדימות של תמונות מהשטח */}
                  {e.photos.length > 0 && (
                    <div className="mt-1.5 flex gap-1 overflow-x-auto">
                      {e.photos.slice(0, 5).map((url, i) => (
                        <img
                          key={i}
                          src={url}
                          alt=""
                          loading="lazy"
                          className="h-12 w-12 flex-shrink-0 rounded object-cover ring-1 ring-border/60"
                        />
                      ))}
                      {e.photos.length > 5 && (
                        <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded bg-muted text-[10px] text-muted-foreground">
                          +{e.photos.length - 5}
                        </span>
                      )}
                    </div>
                  )}
                  {hasChat && (
                    <p className="mt-1 text-[10px] text-primary/70">לחץ לפתיחת השיחה המלאה ›</p>
                  )}
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>

      {chatFor && (
        <OrderChatSheet
          order={{
            id: chatFor.id,
            customerName: customer.customerName,
            city: chatFor.city ?? undefined,
            kind: chatFor.kind === 'service' ? 'service' : 'order',
          }}
          open={!!chatFor}
          onOpenChange={(o) => !o && setChatFor(null)}
        />
      )}
    </>
  );
}
