import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useCurrentProfile } from '@/hooks/useProfile';
import { useMarkServiceCallGreen } from '@/hooks/useServiceCallLights';
import { MANUAL_REASONS, type ManualReason } from '@/lib/service-call-light';
import type { ServiceCall } from '@/types/service-call';

interface ManualGreenDialogProps {
  call: ServiceCall | null;
  onClose: () => void;
}

/**
 * ⭐ סימון ירוק ידני (עידן, 15/09/2026): "ניתן להפוך אותה לירוקה ידנית,
 * אבל חייבים פעולה פיזית של עובד וחתימה במערכת מי עשה את זה".
 * סיבה מרשימה, פירוט לא חובה (חובה ב"אחר"). השם והשעה נחתמים במסד
 * (`mark_service_call_green`), ונרשמים גם בצ'אט של הקריאה.
 */
export function ManualGreenDialog({ call, onClose }: ManualGreenDialogProps) {
  const [reason, setReason] = useState<ManualReason>('phone_described');
  const [note, setNote] = useState('');
  const { data: profile } = useCurrentProfile();
  const mark = useMarkServiceCallGreen();

  useEffect(() => {
    if (call) {
      setReason('phone_described');
      setNote('');
    }
  }, [call]);

  const noteRequired = reason === 'other' && !note.trim();
  const now = new Date().toLocaleString('he-IL', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem',
  });

  const submit = async () => {
    if (!call || noteRequired) return;
    try {
      const res = await mark.mutateAsync({ callId: call.id, reason, note });
      toast.success(`${call.customerName} סומנה ירוקה ונחתמה בשם ${res.by}`);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      toast.error(/not authorized/.test(msg) ? 'רק מי שמשבץ יכול לסמן ירוק ידנית' : 'הסימון נכשל, נסו שוב');
    }
  };

  return (
    <Dialog open={!!call} onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl" className="sm:max-w-md">
        <DialogHeader className="text-start">
          <DialogTitle>לסמן את {call?.customerName} כמוכנה לשיבוץ?</DialogTitle>
          <DialogDescription>אין עדיין תמונה מהלקוח. בחרו למה בכל זאת אפשר לשלוח טכנאי.</DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5" role="radiogroup">
          {MANUAL_REASONS.map((r) => (
            <label
              key={r.value}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                reason === r.value ? 'border-green-300 bg-green-50' : 'hover:bg-muted/50'
              }`}
            >
              <input
                type="radio"
                name="manual-green-reason"
                value={r.value}
                checked={reason === r.value}
                onChange={() => setReason(r.value)}
                className="accent-green-600"
              />
              {r.label}
            </label>
          ))}
        </div>

        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={reason === 'other' ? 'פירוט (חובה ב"אחר")' : 'פירוט (לא חובה)'}
          rows={2}
          className="text-sm"
        />

        <div className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          ייחתם בשם <b className="text-foreground">{profile?.fullName ?? 'המשתמש המחובר'}</b> · <bdi>{now}</bdi>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={mark.isPending}>ביטול</Button>
          <Button
            onClick={submit}
            disabled={mark.isPending || noteRequired}
            className="bg-green-600 text-white hover:bg-green-700"
          >
            ✓ סמן ירוק וחתום
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
