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
import { AlertTriangle, BookOpenCheck, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  TRAINING_SUBTITLE,
  TRAINING_TITLE,
  TRAINING_TOPICS,
  canSubmitTraining,
  trainingProgress,
} from '@/lib/crane-training';
import { saveCraneForm } from '@/lib/crane-forms';
import { SignaturePad } from './SignaturePad';

/**
 * אישור קבלת הדרכה, כטופס דיגיטלי שהלקוח חותם עליו במקום.
 *
 * ⭐ **אותו מבנה בדיוק כמו רשימת הבדיקה לטכנאי**, בכוונה: אותו אדם ממלא
 * את שניהם באותו ביקור, ושני טפסים שנראים אחרת מכריחים אותו ללמוד
 * מסך פעמיים.
 *
 * 🔴🔴 **וההבדל היחיד הוא זה שחשוב: אין כאן שום דרך להגיש חלקית.**
 * הנוסח, השער והנושאים מגיעים כולם מ-`crane-training.ts`, ואי אפשר
 * להחתים לקוח על הדרכה בנושא שלא סומן.
 */
export function CraneTrainingDialog({
  open,
  onOpenChange,
  craneSerial,
  customerName,
  customerNumber,
  stopId,
  orderId,
  technicianName,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  craneSerial?: string | null;
  customerName?: string | null;
  customerNumber?: string | null;
  stopId?: string | null;
  orderId?: string | null;
  technicianName?: string | null;
  onSaved?: () => void;
}) {
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [recipient, setRecipient] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [relation, setRelation] = useState('');
  const [notes, setNotes] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const [slingManufacturer, setSlingManufacturer] = useState('');
  const [slingDate, setSlingDate] = useState('');
  const [slingSerial, setSlingSerial] = useState('');
  const [saving, setSaving] = useState(false);

  const p = useMemo(() => trainingProgress(answers), [answers]);
  const gate = useMemo(
    () => canSubmitTraining(answers, recipient, signature),
    [answers, recipient, signature]
  );

  const toggle = (id: string) => setAnswers((a) => ({ ...a, [id]: !a[id] }));

  /** ⭐ סימון הכל בלחיצה, כי בפועל הטכנאי מסביר את כולם ברצף אחד. */
  const markAll = () =>
    setAnswers(Object.fromEntries(TRAINING_TOPICS.map((t) => [t.id, true])));

  const submit = async () => {
    if (!gate.ok || saving) return;
    setSaving(true);
    try {
      await saveCraneForm({
        formType: 'training',
        craneSerial,
        customerName,
        customerNumber,
        stopId,
        orderId,
        answers,
        verdict: null,
        notes,
        technicianName,
        recipientName: recipient,
        recipientIdNumber: idNumber,
        recipientRelation: relation,
        recipientSignature: signature,
        slingManufacturer,
        slingProductionDate: slingDate,
        slingSerial,
      });
      toast.success('אישור ההדרכה נשמר');
      onSaved?.();
      onOpenChange(false);
      setAnswers({});
      setRecipient('');
      setIdNumber('');
      setRelation('');
      setNotes('');
      setSignature(null);
      setSlingManufacturer('');
      setSlingDate('');
      setSlingSerial('');
    } catch (err) {
      // 🔴 הסיבה על המסך: הטכנאי בבית של לקוח ואין לו איך לפתוח קונסולה.
      toast.error(err instanceof Error ? err.message : 'שמירת האישור נכשלה');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader className="sm:text-start">
          <DialogTitle className="flex items-center gap-2" style={{ color: '#14223a' }}>
            <BookOpenCheck className="h-5 w-5 text-blue-700" />
            {TRAINING_TITLE}
          </DialogTitle>
          <DialogDescription>
            {TRAINING_SUBTITLE}
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
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <h4 className="text-sm font-bold text-blue-800">נושאים שהועברו בהדרכה</h4>
              <button
                type="button"
                onClick={markAll}
                className="text-[11px] font-semibold text-blue-700 hover:underline"
              >
                סמן הכל
              </button>
            </div>
            <div className="space-y-1">
              {TRAINING_TOPICS.map((item) => {
                const on = !!answers[item.id];
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggle(item.id)}
                    className={`flex w-full items-start gap-2.5 rounded-lg border p-2.5 text-start transition-colors ${
                      on ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <span
                      className={`mt-px flex h-5 w-5 flex-none items-center justify-center rounded border-2 ${
                        on ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300'
                      }`}
                    >
                      {on && <Check className="h-3.5 w-3.5" />}
                    </span>
                    <span className="text-[13px] leading-snug text-slate-700">{item.text}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── פרטי הערסל שסופק ── */}
          <div className="rounded-xl border p-3" style={{ borderColor: '#e3e8f0' }}>
            <h4 className="mb-2 text-sm font-bold" style={{ color: '#14223a' }}>
              הערסל שסופק
            </h4>
            {/* ⭐ שלושת השדות אינם חובה: לא בכל אספקה יוצא ערסל, וחסימה
                עליהם הייתה מכריחה את הטכנאי להמציא ערכים. */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Field label="יצרן" value={slingManufacturer} onChange={setSlingManufacturer} />
              <Field label="תאריך ייצור" value={slingDate} onChange={setSlingDate} />
              <Field label="מס׳ סידורי" value={slingSerial} onChange={setSlingSerial} />
            </div>
          </div>

          {/* ── מקבל/ת ההדרכה ── */}
          <div className="rounded-xl border-2 p-3" style={{ borderColor: '#e3e8f0' }}>
            <h4 className="mb-2 text-sm font-bold" style={{ color: '#14223a' }}>
              מקבל/ת ההדרכה
            </h4>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Field label="שם מלא" value={recipient} onChange={setRecipient} />
              <Field label="תעודת זהות" value={idNumber} onChange={setIdNumber} />
              <Field label="קרבה למטופל/ת" value={relation} onChange={setRelation} />
            </div>

            <Textarea
              dir="rtl"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="הערות…"
              className="mt-2 min-h-16"
            />

            <div className="mt-3 space-y-1">
              <label className="text-xs font-semibold text-slate-600">חתימת מקבל/ת ההדרכה</label>
              <SignaturePad onChange={setSignature} />
            </div>

            {technicianName && (
              <p className="mt-2 text-[11px] text-slate-400">
                מסר את ההדרכה: <span className="font-semibold">{technicianName}</span>
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <div className="me-auto flex items-center gap-2 text-xs">
            {gate.ok ? (
              <span className="flex items-center gap-1 font-semibold text-emerald-700">
                <Check className="h-4 w-4" />
                מוכן להחתמה
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-700">
                <AlertTriangle className="h-4 w-4" />
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
            שמור אישור
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-slate-600">{label}</label>
      <Input dir="rtl" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
