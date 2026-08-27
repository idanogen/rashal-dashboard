import { useMemo, useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, Check, ClipboardCheck, Loader2, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import {
  CRANE_CHECKLIST,
  CRANE_CHECKLIST_SUBTITLE,
  CRANE_CHECKLIST_TITLE,
  canSubmit,
  progressOf,
  VERDICT_LABELS,
  type CraneVerdict,
} from '@/lib/crane-checklist';
import { saveCraneForm } from '@/lib/crane-forms';
import { SignaturePad } from './SignaturePad';

/**
 * רשימת הבדיקה לטכנאי, כטופס דיגיטלי.
 *
 * 🔴 **הנוסח מגיע כולו מ-`crane-checklist.ts` ואינו כתוב כאן.** זה טופס
 * בטיחות של ציוד הרמה רפואי, והפרדת הנוסח מהתצוגה היא מה שמאפשר לבדוק
 * אותו בקוד במקום לקרוא אותו בעיניים בכל שינוי.
 *
 * ⭐ **מיועד לטלפון**: הטכנאי ממלא את זה בבית של הלקוח, לא במשרד. לכן
 * שורה אחת לפריט, יעד מגע גדול, וסיכום דביק בתחתית שתמיד אומר מה נשאר.
 */
export function CraneChecklistDialog({
  open,
  onOpenChange,
  craneSerial,
  customerName,
  customerNumber,
  stopId,
  serviceCallId,
  technicianName,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  craneSerial?: string | null;
  customerName?: string | null;
  customerNumber?: string | null;
  stopId?: string | null;
  serviceCallId?: string | null;
  technicianName?: string | null;
  onSaved?: () => void;
}) {
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [verdict, setVerdict] = useState<CraneVerdict | null>(null);
  const [notes, setNotes] = useState('');
  const [recipient, setRecipient] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const p = useMemo(() => progressOf(answers), [answers]);
  const gate = useMemo(() => canSubmit(answers, verdict, recipient), [answers, verdict, recipient]);

  const toggle = (id: string) => setAnswers((a) => ({ ...a, [id]: !a[id] }));

  const submit = async () => {
    if (!gate.ok || saving) return;
    setSaving(true);
    try {
      await saveCraneForm({
        formType: 'inspection',
        craneSerial,
        customerName,
        customerNumber,
        stopId,
        serviceCallId,
        answers,
        verdict,
        notes,
        technicianName,
        recipientName: recipient,
        recipientSignature: signature,
      });
      toast.success('הטופס נשמר');
      onSaved?.();
      onOpenChange(false);
      // איפוס, כדי שפתיחה הבאה לא תתחיל מהטופס הקודם.
      setAnswers({});
      setVerdict(null);
      setNotes('');
      setRecipient('');
      setSignature(null);
    } catch (err) {
      // 🔴 הסיבה נאמרת על המסך ולא רק בלוג: הטכנאי בשטח ואין לו איך
      // לפתוח קונסולה, ובלי הסיבה הוא פשוט ימלא שוב ויקבל אותו כשל.
      toast.error(err instanceof Error ? err.message : 'שמירת הטופס נכשלה');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader className="sm:text-start">
          <DialogTitle className="flex items-center gap-2" style={{ color: '#14223a' }}>
            <ClipboardCheck className="h-5 w-5 text-blue-700" />
            {CRANE_CHECKLIST_TITLE}
          </DialogTitle>
          <DialogDescription>
            {CRANE_CHECKLIST_SUBTITLE}
            {craneSerial && (
              <>
                {' · מס׳ סידורי '}
                <bdi className="font-mono font-semibold">{craneSerial}</bdi>
              </>
            )}
            {customerName && ` · ${customerName}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {CRANE_CHECKLIST.map((section) => (
            <div key={section.id}>
              <h4 className="mb-1.5 text-sm font-bold text-blue-800">{section.title}</h4>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const on = !!answers[item.id];
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggle(item.id)}
                      className={`flex w-full items-start gap-2.5 rounded-lg border p-2.5 text-start transition-colors ${
                        on
                          ? 'border-emerald-300 bg-emerald-50'
                          : item.critical
                            ? 'border-red-200 bg-red-50/50'
                            : 'border-slate-200 bg-white'
                      }`}
                    >
                      <span
                        className={`mt-px flex h-5 w-5 flex-none items-center justify-center rounded border-2 ${
                          on ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300'
                        }`}
                      >
                        {on && <Check className="h-3.5 w-3.5" />}
                      </span>
                      <span
                        className={`text-[13px] leading-snug ${
                          item.critical ? 'font-semibold text-red-800' : 'text-slate-700'
                        }`}
                      >
                        {item.text}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* ── סיכום ── */}
          <div className="rounded-xl border-2 p-3" style={{ borderColor: '#e3e8f0' }}>
            <h4 className="mb-2 text-sm font-bold" style={{ color: '#14223a' }}>
              סיכום
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {(['ok', 'out_of_service'] as CraneVerdict[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVerdict(v)}
                  className={`rounded-lg border-2 p-2.5 text-sm font-semibold transition-colors ${
                    verdict === v
                      ? v === 'ok'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                        : 'border-red-600 bg-red-50 text-red-800'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  {VERDICT_LABELS[v]}
                </button>
              ))}
            </div>

            <Textarea
              dir="rtl"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="הערות…"
              className="mt-2 min-h-16"
            />

            <div className="mt-3 space-y-1">
              <label className="text-xs font-semibold text-slate-600">
                שם מקבל/ת ההדרכה (משתמש/מטפל/ת)
              </label>
              <Input dir="rtl" value={recipient} onChange={(e) => setRecipient(e.target.value)} />
            </div>

            <div className="mt-3 space-y-1">
              <label className="text-xs font-semibold text-slate-600">חתימת מקבל/ת ההדרכה</label>
              <SignaturePad onChange={setSignature} />
            </div>

            {technicianName && (
              <p className="mt-2 text-[11px] text-slate-400">
                הטכנאי המבצע: <span className="font-semibold">{technicianName}</span>
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <div className="me-auto flex items-center gap-2 text-xs">
            {gate.ok ? (
              <span className="flex items-center gap-1 font-semibold text-emerald-700">
                <Check className="h-4 w-4" />
                מוכן להגשה
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-700">
                {p.missingCritical.length > 0 ? (
                  <ShieldAlert className="h-4 w-4" />
                ) : (
                  <AlertTriangle className="h-4 w-4" />
                )}
                {gate.reason}
              </span>
            )}
            <span className="text-slate-400">
              <bdi>
                {p.checked}/{p.total}
              </bdi>
            </span>
          </div>
          <Button onClick={submit} disabled={!gate.ok || saving} className="gap-1">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            שמור טופס
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
