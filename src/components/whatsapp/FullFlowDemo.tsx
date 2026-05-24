import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CustomerReplyBadge } from './CustomerReplyBadge';
import { useOrders } from '@/hooks/useOrders';
import { useSendReminder } from '@/hooks/useWhatsAppSend';
import { useSimulateInbound } from '@/hooks/useWhatsAppMessages';
import { useUpdateOrder } from '@/hooks/useUpdateOrder';
import { useAuth } from '@/lib/auth-context';
import { getTemplate } from '@/lib/heyy/templates';
import { toE164, formatPhoneForDisplay } from '@/lib/heyy/phone';
import {
  Sparkles,
  CheckCircle2,
  Circle,
  ArrowDown,
  RotateCcw,
  Send,
  MessageCircle,
  RefreshCw,
} from 'lucide-react';
import type { Order, CustomerReplyStatus } from '@/types/order';

type StepStatus = 'pending' | 'active' | 'done';

const SCRIPTED_REPLIES: Array<{
  id: string;
  label: string;
  text: string;
  expected: CustomerReplyStatus;
}> = [
  { id: 'yes',     label: '✅ "מתאים, תודה"',        text: 'מתאים, תודה',         expected: 'מתאים' },
  { id: 'no',      label: '❌ "לא מתאים"',           text: 'לא מתאים',            expected: 'לא מתאים' },
  { id: 'change',  label: '✏ "אפשר מחר אחה"צ?"',    text: 'אפשר מחר אחה"צ?',    expected: 'בקשת שינוי' },
  { id: 'morning', label: '🌅 "עדיף בוקר"',          text: 'עדיף בוקר',           expected: 'בקשת שינוי' },
];

interface Snapshot {
  customerReplyStatus?: CustomerReplyStatus;
  customerRequestedTime?: string;
}

export function FullFlowDemo() {
  const { user } = useAuth();
  const { data: orders, refetch: refetchOrders } = useOrders();
  const sendReminder = useSendReminder();
  const simulateInbound = useSimulateInbound();
  const updateOrder = useUpdateOrder();

  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [customText, setCustomText] = useState('');
  const [selectedReplyId, setSelectedReplyId] = useState<string>('yes');
  const [snapshotBefore, setSnapshotBefore] = useState<Snapshot | null>(null);

  const [step1Status, setStep1Status] = useState<StepStatus>('pending');
  const [step2Status, setStep2Status] = useState<StepStatus>('pending');
  const [step3Status, setStep3Status] = useState<StepStatus>('pending');

  const ordersWithPhone = useMemo(
    () => (orders ?? []).filter((o) => o.phone && o.customerName),
    [orders]
  );

  const selectedOrder: Order | undefined = ordersWithPhone.find((o) => o.id === selectedOrderId);
  const triggeredBy = user?.email ? `user:${user.email}` : 'user:demo';
  const scriptedReply = SCRIPTED_REPLIES.find((r) => r.id === selectedReplyId);
  const replyTextToSend = customText.trim() || scriptedReply?.text || '';

  function reset() {
    setStep1Status('pending');
    setStep2Status('pending');
    setStep3Status('pending');
    setSnapshotBefore(null);
    setCustomText('');
  }

  async function handlePickOrder(id: string) {
    setSelectedOrderId(id);
    reset();
    if (id) {
      const o = ordersWithPhone.find((x) => x.id === id);
      if (o) {
        setSnapshotBefore({
          customerReplyStatus: o.customerReplyStatus,
          customerRequestedTime: o.customerRequestedTime,
        });
        // Wipe any previous demo state on the order so the diff is meaningful
        if (o.customerReplyStatus || o.customerRequestedTime) {
          await updateOrder.mutateAsync({
            id: o.id,
            fields: { customerReplyStatus: undefined, customerRequestedTime: undefined },
          });
          await refetchOrders();
        }
      }
    }
  }

  async function handleStep1Send() {
    if (!selectedOrder) return;
    setStep1Status('active');
    const result = await sendReminder.mutateAsync({
      reminderKind: 'schedule_request',
      phone: selectedOrder.phone!,
      orderId: selectedOrder.id,
      params: { customerName: selectedOrder.customerName },
      triggeredBy: triggeredBy + ':demo-flow',
    });
    if (result.ok) {
      // Mark order as 'waiting for reply' so the badge appears between steps
      await updateOrder.mutateAsync({
        id: selectedOrder.id,
        fields: { customerReplyStatus: 'ממתין' },
      });
      await refetchOrders();
      setStep1Status('done');
    } else {
      setStep1Status('pending');
    }
  }

  async function handleStep2Simulate() {
    if (!selectedOrder || !replyTextToSend) return;
    const phoneE164 = toE164(selectedOrder.phone);
    if (!phoneE164) return;
    setStep2Status('active');
    await simulateInbound.mutateAsync({
      phoneE164,
      bodyText: replyTextToSend,
    });
    // Webhook updates the order asynchronously — give it a moment and refetch
    await new Promise((r) => setTimeout(r, 400));
    await refetchOrders();
    setStep2Status('done');
    setStep3Status('done');
  }

  async function handleStartOver() {
    if (selectedOrder && snapshotBefore) {
      await updateOrder.mutateAsync({
        id: selectedOrder.id,
        fields: {
          customerReplyStatus: snapshotBefore.customerReplyStatus,
          customerRequestedTime: snapshotBefore.customerRequestedTime,
        },
      });
      await refetchOrders();
    }
    reset();
    setSelectedOrderId('');
  }

  // Re-read the order from the orders cache to show live updates
  const liveOrder = ordersWithPhone.find((o) => o.id === selectedOrderId);

  return (
    <Card className="border-purple-200 bg-gradient-to-br from-purple-50/40 to-amber-50/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-purple-600" />
          דמו מלא מקצה-לקצה
          <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 text-[10px]">
            מצב דמו
          </Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          מציג את הזרימה המלאה: <strong>שלח בקשת תיאום</strong> ⟵ <strong>סימלץ תשובת לקוח</strong> ⟵{' '}
          <strong>ראה את ההזמנה מתעדכנת אוטומטית</strong>. אותה זרימה בדיוק תעבוד עם heyy אמיתי.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Order picker */}
        <div className="space-y-1.5">
          <Label className="text-xs">1. בחר הזמנה לסימולציה</Label>
          <div className="flex gap-2">
            <Select value={selectedOrderId} onValueChange={handlePickOrder}>
              <SelectTrigger className="h-9 flex-1">
                <SelectValue placeholder="-- בחר הזמנה --" />
              </SelectTrigger>
              <SelectContent>
                {ordersWithPhone.slice(0, 50).map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.customerName} ({o.phone})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedOrderId && (
              <Button variant="outline" size="sm" onClick={handleStartOver}>
                <RotateCcw className="h-3.5 w-3.5 me-1" />
                התחל מחדש
              </Button>
            )}
          </div>
        </div>

        {selectedOrder && (
          <>
            {/* Step 1: send schedule_request */}
            <StepRow
              num={1}
              status={step1Status}
              icon={Send}
              title="שלח בקשת תיאום ללקוח"
              subtitle={`template "schedule_request" → ${formatPhoneForDisplay(selectedOrder.phone)}`}
            >
              <div className="rounded-lg border bg-white/60 p-2 text-xs whitespace-pre-line text-muted-foreground">
                {previewBody(selectedOrder)}
              </div>
              <Button
                size="sm"
                onClick={handleStep1Send}
                disabled={step1Status !== 'pending' || sendReminder.isPending}
                className="mt-2"
              >
                {step1Status === 'done' ? '✓ נשלח' : sendReminder.isPending ? 'שולח...' : 'שלח בקשה'}
              </Button>
            </StepRow>

            <ArrowDown className="h-4 w-4 text-muted-foreground mx-auto" />

            {/* Step 2: simulate inbound reply */}
            <StepRow
              num={2}
              status={step1Status === 'done' ? (step2Status === 'pending' ? 'active' : step2Status) : 'pending'}
              icon={MessageCircle}
              title="סימלץ תשובת הלקוח"
              subtitle="בחר תרחיש או הקלד תשובה חופשית"
              disabled={step1Status !== 'done'}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Select
                  value={selectedReplyId}
                  onValueChange={(v) => {
                    setSelectedReplyId(v);
                    setCustomText('');
                  }}
                  disabled={step2Status === 'done'}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCRIPTED_REPLIES.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.label} → <span className="opacity-60">{r.expected}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="או הקלד תשובה חופשית..."
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  disabled={step2Status === 'done'}
                  className="h-9"
                />
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                הלקוח ישלח: <span className="font-medium text-foreground" dir="auto">"{replyTextToSend}"</span>
              </div>
              <Button
                size="sm"
                onClick={handleStep2Simulate}
                disabled={
                  step1Status !== 'done' ||
                  step2Status === 'done' ||
                  !replyTextToSend ||
                  simulateInbound.isPending
                }
                className="mt-2"
              >
                {step2Status === 'done' ? '✓ הלקוח ענה' : simulateInbound.isPending ? 'שולח...' : 'סמלץ תשובה'}
              </Button>
            </StepRow>

            <ArrowDown className="h-4 w-4 text-muted-foreground mx-auto" />

            {/* Step 3: order updated */}
            <StepRow
              num={3}
              status={step3Status}
              icon={RefreshCw}
              title="ההזמנה מתעדכנת אוטומטית"
              subtitle="webhook → parser → orders.customer_reply_status"
              disabled={step2Status !== 'done'}
            >
              <div className="grid grid-cols-2 gap-2">
                <DiffBlock label="לפני" snapshot={snapshotBefore ?? {}} />
                <DiffBlock
                  label="אחרי"
                  highlight={step3Status === 'done'}
                  snapshot={{
                    customerReplyStatus: liveOrder?.customerReplyStatus,
                    customerRequestedTime: liveOrder?.customerRequestedTime,
                  }}
                />
              </div>
              {step3Status === 'done' && (
                <p className="mt-2 text-xs text-purple-700 bg-purple-50 border border-purple-200 rounded p-2">
                  ✨ עבור הלקוח <strong>{liveOrder?.customerName}</strong>: parser זיהה את התשובה ועדכן את ההזמנה.
                  ב-prod זה היה קורה תוך 1-2 שניות אחרי שהלקוח לחץ Send ב-WhatsApp.
                </p>
              )}
            </StepRow>
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface StepRowProps {
  num: number;
  status: StepStatus;
  icon: typeof CheckCircle2;
  title: string;
  subtitle: string;
  disabled?: boolean;
  children?: React.ReactNode;
}

function StepRow({ num, status, icon: Icon, title, subtitle, disabled, children }: StepRowProps) {
  const statusIcon = status === 'done' ? CheckCircle2 : Circle;
  const StatusIcon = statusIcon;
  return (
    <div
      className={
        'rounded-lg border p-3 transition-all ' +
        (disabled
          ? 'opacity-40 bg-muted/20'
          : status === 'done'
          ? 'bg-green-50/50 border-green-200'
          : status === 'active'
          ? 'bg-purple-50/50 border-purple-200'
          : 'bg-white/60')
      }
    >
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center pt-0.5">
          <StatusIcon
            className={
              'h-5 w-5 ' +
              (status === 'done' ? 'text-green-600' : status === 'active' ? 'text-purple-600' : 'text-muted-foreground')
            }
          />
          <span className="text-[10px] mt-1 font-bold text-muted-foreground">שלב {num}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{title}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
          <div className="mt-2">{children}</div>
        </div>
      </div>
    </div>
  );
}

function DiffBlock({ label, snapshot, highlight }: { label: string; snapshot: Snapshot; highlight?: boolean }) {
  const empty = !snapshot.customerReplyStatus && !snapshot.customerRequestedTime;
  return (
    <div
      className={
        'rounded-lg border p-2 text-xs ' +
        (highlight ? 'bg-green-50 border-green-300' : 'bg-muted/30 border-muted')
      }
    >
      <div className="text-[10px] font-semibold text-muted-foreground mb-1">{label}</div>
      {empty ? (
        <div className="text-muted-foreground italic">— ריק —</div>
      ) : (
        <>
          {snapshot.customerReplyStatus && (
            <CustomerReplyBadge
              status={snapshot.customerReplyStatus}
              requestedTime={snapshot.customerRequestedTime}
            />
          )}
        </>
      )}
    </div>
  );
}

function previewBody(order: Order): string {
  const tpl = getTemplate('schedule_request');
  const params = tpl.buildParams({ customerName: order.customerName });
  return tpl.bodyPreview.replace(/\{\{(\d+)\}\}/g, (_, n) => params[Number(n) - 1] ?? '');
}
