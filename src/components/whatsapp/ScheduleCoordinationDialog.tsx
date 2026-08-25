import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Phone, Calendar, Clock, MapPin, User, CheckCircle2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { CalendarStop } from '@/types/delivery';
import { useUpdateStopCoordination } from '@/hooks/useUpdateStopCoordination';
import { useActivityLogger } from '@/hooks/useActivityLogger';
import { fetchThread, sendTemplate } from '@/lib/wa-inbox';
import {
  COORDINATION_TEMPLATE_KEY, PURPOSES,
  coordinationPreview, coordinationValues, hebrewDay,
} from '@/lib/coordination-message';
import { formatPhoneForDisplay } from '@/lib/heyy/phone';
import { CoordinationStatusBadge } from './CoordinationStatusBadge';

interface ScheduleCoordinationDialogProps {
  stop: CalendarStop | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * תיאום של קבוצת עצירות ברצף, אחרי שיבוץ קבוצתי.
   * מציג "עצירה N מתוך M" ומאפשר לצאת מהרצף בלחיצה אחת.
   */
  queue?: { index: number; total: number; onFinishAll: () => void };
}

/**
 * 🔴 **התאריך שעל המסך נגזר מאותה פונקציה שבונה את ההודעה.** היו כאן שתי
 * גזירות, וכל אחת הייתה יכולה לזוז בנפרד. [[label_and_math_from_two_mechanisms]]
 */
const dateForScreen = (iso: string) => {
  const v = hebrewDay(iso);
  return v === iso ? iso : `יום ${v}`;
};

export function ScheduleCoordinationDialog({
  stop,
  open,
  onOpenChange,
  queue,
}: ScheduleCoordinationDialogProps) {
  const updateCoord = useUpdateStopCoordination();
  const log = useActivityLogger();
  const [sending, setSending] = useState(false);

  /** הקשר אירוע תיאום ללוג — מי/על מי/באיזו דרך (למנהל). */
  const logCoordination = (action: string, method: string) => {
    if (!stop) return;
    log(action, {
      entityType: 'calendar_stop',
      entityId: stop.stopId,
      sourceType: stop.sourceType,
      customerName: stop.customerName,
      metadata: { method, timeStart, timeEnd, note: note || undefined },
    });
  };

  const [timeStart, setTimeStart] = useState('09:00');
  const [timeEnd, setTimeEnd] = useState('13:00');
  const [note, setNote] = useState('');
  /** ⭐ ברירת המחדל נגזרת מסוג העצירה, כי זה מה שהיא בפועל. */
  const [purpose, setPurpose] = useState<string>(PURPOSES[0].value);

  // Sync state when stop changes (dialog re-opens for a different stop)
  useEffect(() => {
    if (stop) {
      setTimeStart(stop.timeWindowStart ?? '09:00');
      setTimeEnd(stop.timeWindowEnd ?? '13:00');
      setNote('');
      setPurpose(
        stop.sourceType === 'pickup' ? 'לאיסוף הציוד'
          : stop.sourceType === 'service' ? 'לביקור טכנאי'
            : 'לאספקת הציוד',
      );
    }
  }, [stop?.stopId, stop]);

  /**
   * 🔴 **זמינות התבנית נקראת מהשרת ולא נקבעת כאן.** הכלל "מה מותר לשלוח"
   * מוצהר פעם אחת ב-`toPanelTemplates`, ותבנית שמטא עוד לא אישרה חוזרת
   * עם `available: false` ועם הסיבה, במקום להיעלם.
   * [[screen_and_sender_must_share_one_module]]
   */
  const { data: thread } = useQuery({
    queryKey: ['coordinationTemplate', stop?.phone ?? ''],
    queryFn: () => fetchThread(stop!.phone!),
    enabled: open && !!stop?.phone,
    staleTime: 60_000,
  });

  if (!stop) return null;

  const tpl = thread?.templates?.find((t) => t.key === COORDINATION_TEMPLATE_KEY);
  const dateLabel = dateForScreen(stop.deliveryDate);
  const hasPhone = !!stop.phone;
  const canSend = Boolean(tpl?.available);
  const blockedReason = !hasPhone
    ? 'אין מספר טלפון'
    : !tpl
      ? 'תבנית התיאום עוד לא הודלקה במסך התבניות.'
      : !tpl.available
        ? (tpl.unavailableReason ?? 'התבנית אינה זמינה לשליחה.')
        : null;

  const previewBody = coordinationPreview({
    customerName: stop.customerName,
    purpose,
    date: stop.deliveryDate,
    timeStart,
    timeEnd,
  });

  async function handleSendWhatsApp() {
    if (!stop || !hasPhone || !canSend || sending) return;
    setSending(true);
    try {
      await sendTemplate(
        stop.phone!,
        COORDINATION_TEMPLATE_KEY,
        coordinationValues({
          customerName: stop.customerName,
          purpose,
          date: stop.deliveryDate,
          timeStart,
          timeEnd,
        }),
      );
    } catch (e) {
      // 🔴 **הכישלון נאמר, ולא מסומן כנשלח.** שליחה שנחסמה ברשימת
      // המושתקים או מחוץ לחלון מחזירה שגיאה, וסימון "WA נשלח" עליה היה
      // אומר לסדרן שהלקוח קיבל הודעה שמעולם לא יצאה.
      toast.error(e instanceof Error ? e.message : 'השליחה נכשלה');
      setSending(false);
      return;
    }
    await updateCoord.mutateAsync({
      stopId: stop.stopId,
      silent: true,
      fields: {
        coordinationStatus: 'whatsapp_sent',
        coordinationMethod: 'whatsapp',
        coordinatedAt: new Date().toISOString(),
        timeWindowStart: timeStart,
        timeWindowEnd: timeEnd,
        notes: note || undefined,
        coordinationNeedsCancel: false,
      },
    });
    logCoordination('coordinate_whatsapp', 'whatsapp');
    toast.success('הודעת התיאום נשלחה');
    setSending(false);
    onOpenChange(false);
  }

  async function handleMarkPhoneConfirmed() {
    if (!stop) return;
    await updateCoord.mutateAsync({
      stopId: stop.stopId,
      fields: {
        coordinationStatus: 'phone_confirmed',
        coordinationMethod: 'phone',
        coordinatedAt: new Date().toISOString(),
        timeWindowStart: timeStart || undefined,
        timeWindowEnd: timeEnd || undefined,
        notes: note || undefined,
        coordinationNeedsCancel: false,
      },
    });
    logCoordination('coordinate_phone', 'phone');
    onOpenChange(false);
  }

  async function handleClearCoordination() {
    if (!stop) return;
    await updateCoord.mutateAsync({
      stopId: stop.stopId,
      fields: {
        coordinationStatus: undefined,
        coordinationMethod: undefined,
        coordinatedAt: undefined,
        coordinationNeedsCancel: false,
      },
    });
    logCoordination('coordinate_clear', 'clear');
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-emerald-600" />
            תיאום משלוח / שירות עם הלקוח
            {tpl && (
              <Badge
                variant="outline"
                className={
                  tpl.category === 'utility'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]'
                    : 'bg-amber-50 text-amber-700 border-amber-200 text-[10px]'
                }
              >
                {tpl.category === 'utility' ? 'תבנית שירות' : 'תבנית שיווק'}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            הזן את חלון הזמן ושלח הודעת תיאום ב-WhatsApp, או סמן שביצעת תיאום טלפוני.
          </DialogDescription>
        </DialogHeader>

        {queue && (
          <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50/60 px-3 py-2 text-xs">
            <span className="font-medium text-blue-800">
              תיאום ברצף · עצירה {queue.index + 1} מתוך {queue.total}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={queue.onFinishAll}
              className="h-6 px-2 text-[11px] text-blue-700 hover:bg-blue-100"
            >
              סיים, אתאם אחר כך
            </Button>
          </div>
        )}

        {/* Stop details */}
        <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5 text-sm">
          <div className="flex items-center gap-2">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-semibold">{stop.customerName}</span>
            {stop.coordinationStatus && (
              <CoordinationStatusBadge status={stop.coordinationStatus} className="text-[10px]" />
            )}
          </div>
          {hasPhone && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-3.5 w-3.5" />
              <span dir="ltr">{formatPhoneForDisplay(stop.phone)}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span>{dateLabel}</span>
          </div>
          {(stop.address || stop.city) && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              <span>
                {stop.address}
                {stop.city ? `, ${stop.city}` : ''}
              </span>
            </div>
          )}
        </div>

        {/* Time window inputs */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="time-start" className="text-xs flex items-center gap-1">
              <Clock className="h-3 w-3" /> משעה
            </Label>
            <Input
              id="time-start"
              type="time"
              value={timeStart}
              onChange={(e) => setTimeStart(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="time-end" className="text-xs flex items-center gap-1">
              <Clock className="h-3 w-3" /> עד שעה
            </Label>
            <Input
              id="time-end"
              type="time"
              value={timeEnd}
              onChange={(e) => setTimeEnd(e.target.value)}
              className="h-9"
            />
          </div>
        </div>

        {/* לשם מה אנחנו מגיעים. רשימה סגורה, ראה `coordination-message.ts`. */}
        <div className="space-y-1.5">
          <Label className="text-xs">מטרת ההגעה</Label>
          <div className="flex flex-wrap gap-1.5">
            {PURPOSES.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPurpose(p.value)}
                className={`rounded-lg border px-2.5 py-1 text-[11.5px] font-medium transition ${
                  purpose === p.value
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* 🔴 הערה פנימית בלבד. אין בתבנית חריץ לטקסט חופשי, במכוון. */}
        <div className="space-y-1.5">
          <Label htmlFor="note" className="text-xs">הערה לתיעוד (לא נשלחת ללקוח)</Label>
          <Input
            id="note"
            placeholder='לדוגמה: "נא להתקשר בכניסה"'
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="h-9"
          />
        </div>

        {/* WhatsApp preview */}
        {hasPhone && (
          <div className="rounded-lg border bg-emerald-50/30 p-2.5 text-xs whitespace-pre-line">
            <div className="text-[10px] font-semibold text-emerald-700 mb-1.5">
              📱 תצוגה מקדימה של הודעת ה-WhatsApp
            </div>
            {previewBody}
            <div className="mt-2 text-[10px] text-slate-500">
              מתחת להודעה יופיעו שני כפתורים: "מתאים לי" ו"לא מתאים". לחיצה
              מסמנת את העצירה ביומן בלי שאיש יצטרך לקרוא את התשובה.
            </div>
            {blockedReason && (
              <div className="mt-2 text-amber-700 text-[10px]">
                ⚠ {blockedReason} עד שזה ייפתר, סמנו "תואם טלפונית".
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {stop.coordinationStatus && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearCoordination}
              disabled={updateCoord.isPending}
              className="text-xs text-muted-foreground"
            >
              נקה תיאום
            </Button>
          )}
          <div className="flex-1" />
          <Button
            variant="outline"
            onClick={handleMarkPhoneConfirmed}
            disabled={updateCoord.isPending}
            className="gap-1.5"
          >
            <Phone className="h-4 w-4" />
            סמן כתואם טלפונית
          </Button>
          <Button
            onClick={handleSendWhatsApp}
            // תבנית שממתינה לאישור מטא תיכשל בשליחה. עדיף כפתור מושבת עם הסבר
            // מאשר לחיצה שמחזירה שגיאה טכנית.
            disabled={!!blockedReason || sending || updateCoord.isPending}
            className="gap-1.5"
            title={blockedReason ?? undefined}
          >
            {sending ? (
              'שולח...'
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                שלח WhatsApp
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
