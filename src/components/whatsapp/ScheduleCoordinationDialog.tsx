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
import type { CalendarStop } from '@/types/delivery';
import { useSendReminder } from '@/hooks/useWhatsAppSend';
import { useUpdateStopCoordination } from '@/hooks/useUpdateStopCoordination';
import { useAuth } from '@/lib/auth-context';
import { getTemplate, isPlaceholderTemplate } from '@/lib/heyy/templates';
import { isDemoMode } from '@/lib/heyy/client';
import { formatPhoneForDisplay } from '@/lib/heyy/phone';
import { CoordinationStatusBadge } from './CoordinationStatusBadge';

interface ScheduleCoordinationDialogProps {
  stop: CalendarStop | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatHebrewDate(yyyyMmDd: string): string {
  // "2026-05-26" → "יום ג', 26.5.2026"
  const d = new Date(yyyyMmDd + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return yyyyMmDd;
  const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const dayName = dayNames[d.getDay()];
  const dateStr = d.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: 'numeric' });
  return `יום ${dayName}, ${dateStr}`;
}

export function ScheduleCoordinationDialog({ stop, open, onOpenChange }: ScheduleCoordinationDialogProps) {
  const { user } = useAuth();
  const sendReminder = useSendReminder();
  const updateCoord = useUpdateStopCoordination();

  const [timeStart, setTimeStart] = useState('09:00');
  const [timeEnd, setTimeEnd] = useState('13:00');
  const [note, setNote] = useState('');

  // Sync state when stop changes (dialog re-opens for a different stop)
  useEffect(() => {
    if (stop) {
      setTimeStart(stop.timeWindowStart ?? '09:00');
      setTimeEnd(stop.timeWindowEnd ?? '13:00');
      setNote('');
    }
  }, [stop?.stopId, stop]);

  if (!stop) return null;

  const triggeredBy = user?.email ? `user:${user.email}` : 'user:anonymous';
  const demo = isDemoMode();
  const tpl = getTemplate('schedule_coordination');
  const dateLabel = formatHebrewDate(stop.deliveryDate);
  const hasPhone = !!stop.phone;
  const placeholder = isPlaceholderTemplate(tpl.templateId);

  const previewBody = tpl.bodyPreview.replace(/\{\{(\d+)\}\}/g, (_, n) => {
    const params = tpl.buildParams({
      customerName: stop.customerName,
      dateLabel,
      timeStart,
      timeEnd,
      note,
    });
    return params[Number(n) - 1] ?? '';
  });

  async function handleSendWhatsApp() {
    if (!stop || !hasPhone) return;
    const result = await sendReminder.mutateAsync({
      reminderKind: 'schedule_coordination',
      phone: stop.phone!,
      orderId: stop.sourceType === 'delivery' ? stop.sourceId : undefined,
      params: {
        customerName: stop.customerName,
        dateLabel,
        timeStart,
        timeEnd,
        note,
      },
      triggeredBy,
    });
    if (result.ok) {
      await updateCoord.mutateAsync({
        stopId: stop.stopId,
        silent: true,
        fields: {
          coordinationStatus: 'whatsapp_sent',
          coordinationMethod: 'whatsapp',
          coordinatedAt: new Date().toISOString(),
          timeWindowStart: timeStart,
          timeWindowEnd: timeEnd,
        },
      });
      onOpenChange(false);
    }
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
      },
    });
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
      },
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-emerald-600" />
            תיאום משלוח / שירות עם הלקוח
            {demo && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
                דמו
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            הזן את חלון הזמן ושלח הודעת תיאום ב-WhatsApp, או סמן שביצעת תיאום טלפוני.
          </DialogDescription>
        </DialogHeader>

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

        {/* Optional note */}
        <div className="space-y-1.5">
          <Label htmlFor="note" className="text-xs">הערה (אופציונלי — יתווסף להודעה / לתיעוד)</Label>
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
            {placeholder && (
              <div className="mt-2 text-amber-700 text-[10px]">
                ⚠ ה-template עוד לא מאושר ב-Meta. במצב דמו ההודעה תשמר כלוג, ב-prod (real mode) השליחה תיכשל עם הודעת שגיאה מנחה.
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
            disabled={!hasPhone || sendReminder.isPending || updateCoord.isPending}
            className="gap-1.5"
            title={!hasPhone ? 'אין מספר טלפון' : undefined}
          >
            {sendReminder.isPending ? (
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
