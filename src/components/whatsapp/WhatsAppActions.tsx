import { useState } from 'react';
import { MessageCircle, CalendarClock, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import type { Order } from '@/types/order';
import { useSendReminder } from '@/hooks/useWhatsAppSend';
import { useUpdateOrder } from '@/hooks/useUpdateOrder';
import { getTemplate, isPlaceholderTemplate } from '@/lib/heyy/templates';
import { isDemoMode } from '@/lib/heyy/client';
import { formatPhoneForDisplay } from '@/lib/heyy/phone';
import { useAuth } from '@/lib/auth-context';

interface WhatsAppActionsProps {
  order: Order;
  /** Compact variant — single icon-only button (for inside table rows). */
  compact?: boolean;
}

export function WhatsAppActions({ order, compact = false }: WhatsAppActionsProps) {
  const { user } = useAuth();
  const sendReminder = useSendReminder();
  const updateOrder = useUpdateOrder();
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [showRemindNowDialog, setShowRemindNowDialog] = useState(false);
  const [scheduleAt, setScheduleAt] = useState('');

  const triggeredBy = user?.email ? `user:${user.email}` : 'user:anonymous';
  const hasPhone = !!order.phone;
  const demo = isDemoMode();

  function handleSendDeliveryReminder() {
    sendReminder.mutate({
      reminderKind: 'delivery_reminder',
      phone: order.phone!,
      orderId: order.id,
      params: {
        customerName: order.customerName,
        timeStart: '08:00',
        timeEnd: '18:00',
        address: order.address ?? '',
      },
      triggeredBy,
    });
    setShowRemindNowDialog(false);
  }

  function handleSendScheduleRequest() {
    sendReminder.mutate({
      reminderKind: 'schedule_request',
      phone: order.phone!,
      orderId: order.id,
      params: { customerName: order.customerName },
      triggeredBy,
    });
    updateOrder.mutate({
      id: order.id,
      fields: { customerReplyStatus: 'ממתין' },
    });
  }

  function handleSaveScheduledTime() {
    if (!scheduleAt) return;
    updateOrder.mutate({
      id: order.id,
      fields: { scheduledReminderAt: new Date(scheduleAt).toISOString() },
    });
    setShowScheduleDialog(false);
    setScheduleAt('');
  }

  const trigger = compact ? (
    <Button variant="ghost" size="sm" disabled={!hasPhone} title={!hasPhone ? 'אין מספר טלפון' : 'פעולות וואטסאפ'}>
      <MessageCircle className="h-4 w-4 text-emerald-600" />
    </Button>
  ) : (
    <Button variant="outline" size="sm" disabled={!hasPhone}>
      <MessageCircle className="h-4 w-4 text-emerald-600" />
      <span className="hidden sm:inline">וואטסאפ</span>
      {demo && <Badge variant="outline" className="ms-1 bg-amber-50 text-amber-700 border-amber-200 text-[10px] px-1 py-0">דמו</Badge>}
    </Button>
  );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[220px]">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            {order.phone ? formatPhoneForDisplay(order.phone) : 'ללא טלפון'}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setShowRemindNowDialog(true)} disabled={!hasPhone}>
            <MessageCircle className="h-4 w-4 me-2 text-emerald-600" />
            שלח תזכורת משלוח עכשיו
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleSendScheduleRequest} disabled={!hasPhone || sendReminder.isPending}>
            <MoreVertical className="h-4 w-4 me-2 text-blue-600" />
            בקש תיאום משלוח
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setShowScheduleDialog(true)}>
            <CalendarClock className="h-4 w-4 me-2 text-purple-600" />
            תזמן תזכורת ידנית
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Confirm delivery reminder */}
      <Dialog open={showRemindNowDialog} onOpenChange={setShowRemindNowDialog}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>שלח תזכורת משלוח</DialogTitle>
            <DialogDescription>
              ההודעה תישלח דרך WhatsApp בעוד כמה שניות. {demo && '(מצב דמו — לא נשלח לוואטסאפ אמיתי)'}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-muted/30 p-3 text-sm whitespace-pre-line">
            <div className="text-xs text-muted-foreground mb-2">תצוגה מקדימה (template: delivery_reminder)</div>
            {previewBody(order)}
          </div>
          {isPlaceholderTemplate(getTemplate('delivery_reminder').templateId) && (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
              ⚠ ה-template עוד לא מאושר ב-Meta. כרגע יישמר רק לוג ב-DB.
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRemindNowDialog(false)}>
              ביטול
            </Button>
            <Button onClick={handleSendDeliveryReminder} disabled={sendReminder.isPending}>
              {sendReminder.isPending ? 'שולח...' : 'שלח עכשיו'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule a manual reminder */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>תזמן תזכורת ידנית</DialogTitle>
            <DialogDescription>
              שמור תאריך ושעה לתזכורת. (פיצ'ר השליחה האוטומטית בשעה זו ייושם בשלב הבא — לעת עתה זה רק תיוג להזמנה)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="schedule-at">מתי לשלוח לוואטסאפ?</Label>
            <Input
              id="schedule-at"
              type="datetime-local"
              value={scheduleAt}
              onChange={(e) => setScheduleAt(e.target.value)}
            />
            {order.scheduledReminderAt && (
              <div className="text-xs text-muted-foreground">
                מתוזמן כרגע ל: {new Date(order.scheduledReminderAt).toLocaleString('he-IL')}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScheduleDialog(false)}>
              ביטול
            </Button>
            <Button onClick={handleSaveScheduledTime} disabled={!scheduleAt || updateOrder.isPending}>
              שמור
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function previewBody(order: Order): string {
  const tpl = getTemplate('delivery_reminder');
  const params = tpl.buildParams({
    customerName: order.customerName,
    timeStart: '08:00',
    timeEnd: '18:00',
    address: order.address ?? '',
  });
  return tpl.bodyPreview.replace(/\{\{(\d+)\}\}/g, (_, n) => params[Number(n) - 1] ?? '');
}
