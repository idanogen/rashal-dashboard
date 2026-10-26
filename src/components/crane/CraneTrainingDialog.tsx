import { useState } from 'react';
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
import { AlertTriangle, BookOpenCheck, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  TRAINING_ANSWERS,
  TRAINING_RELATIONS,
  TRAINING_SATISFACTION,
  TRAINING_SECTIONS,
  TRAINING_TITLE,
  canSubmitTraining,
  type TrainingClause,
} from '@/lib/crane-training';
import { attachCraneFormPdf, craneTrainingFileDes, saveCraneForm, uploadSlingPhoto } from '@/lib/crane-forms';
import { PhotoSlotInput } from '@/components/forms/PhotoSlotInput';
import { craneTrainingLayout } from '@/lib/forms/layouts/crane-training';
import { renderHtmlToPdf } from '@/lib/forms/render';
import { SignaturePad } from './SignaturePad';

/**
 * אישור קבלת הדרכה על מנוף חשמלי, כטופס דיגיטלי שהלקוח חותם עליו במקום.
 *
 * ⭐⭐ גרסה 3 (26/10/2026): טופס הנייר של ר.שעל. סעיפים 1 עד 3 מוצגים
 * לקריאה, וממלאים את 4 (מקבל ההדרכה) ואת 6 (הערסל). 5 (מבצע ההדרכה) הוא
 * הנהג המחובר. השער והנוסח ב-`crane-training.ts`.
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
  onDemoSubmit,
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
  /**
   * מסך ההדגמה (`/forms-demo`): מקבל את ה-PDF האמיתי ולא שומר כלום,
   * לא במסד ולא בפריוריטי.
   */
  onDemoSubmit?: (pdf: Blob) => Promise<void> | void;
}) {
  const [recipient, setRecipient] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [relation, setRelation] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const [slingManufacturer, setSlingManufacturer] = useState('');
  const [slingDate, setSlingDate] = useState('');
  const [slingSerial, setSlingSerial] = useState('');
  const [slingPhoto, setSlingPhoto] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const sling = { manufacturer: slingManufacturer, productionDate: slingDate, serial: slingSerial };
  const gate = canSubmitTraining({
    recipientName: recipient, recipientIdNumber: idNumber, recipientRelation: relation, signature, sling, slingPhoto,
  });

  const buildPdf = (signedAt: Date) =>
    renderHtmlToPdf(craneTrainingLayout({
      title: TRAINING_TITLE,
      sections: TRAINING_SECTIONS,
      satisfaction: TRAINING_SATISFACTION,
      customerName: customerName ?? '',
      customerNumber,
      craneSerial,
      recipientName: recipient,
      recipientIdNumber: idNumber,
      recipientRelation: relation,
      sling,
      slingPhoto,
      signature,
      meta: { signedAt, driverName: technicianName ?? '' },
    }));

  const reset = () => {
    setRecipient('');
    setIdNumber('');
    setRelation('');
    setSignature(null);
    setSlingManufacturer('');
    setSlingDate('');
    setSlingSerial('');
    setSlingPhoto(null);
  };

  const submit = async () => {
    if (!gate.ok || saving) return;
    setSaving(true);
    if (onDemoSubmit) {
      try {
        await onDemoSubmit(await buildPdf(new Date()));
        onOpenChange(false);
        reset();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'הפקת ה-PDF נכשלה');
      } finally {
        setSaving(false);
      }
      return;
    }
    try {
      // 🔴 הצילום קודם: המסד דוחה אישור בלי ערסל ובלי צילום.
      if (slingPhoto && !stopId) throw new Error('אי אפשר לצרף צילום בלי עצירה');
      const slingPhotoPath = slingPhoto && stopId ? await uploadSlingPhoto(stopId, slingPhoto) : null;
      const formId = await saveCraneForm({
        formType: 'training',
        craneSerial,
        customerName,
        customerNumber,
        stopId,
        orderId,
        answers: TRAINING_ANSWERS,
        verdict: null,
        notes: '',
        technicianName,
        recipientName: recipient,
        recipientIdNumber: idNumber,
        recipientRelation: relation,
        recipientSignature: signature,
        slingManufacturer,
        slingProductionDate: slingDate,
        slingSerial,
        slingPhotoPath,
      });
      // ⭐ ה-PDF אחרי השמירה ולא בתוכה: כשל בצירוף לא מאבד את החתימה.
      if (stopId) {
        try {
          const signedAt = new Date();
          const pdf = await buildPdf(signedAt);
          await attachCraneFormPdf(formId, stopId, pdf, craneTrainingFileDes(customerName ?? '', craneSerial, signedAt));
        } catch (err) {
          toast.warning(`האישור נשמר, אבל צירוף ה-PDF לכרטיס הלקוח נכשל: ${err instanceof Error ? err.message : err}`);
        }
      }
      toast.success('אישור ההדרכה נשמר');
      onSaved?.();
      onOpenChange(false);
      reset();
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
            {customerName}
            {craneSerial && (
              <>
                {' · מס׳ סידורי '}
                <bdi className="font-mono font-semibold">{craneSerial}</bdi>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-3 rounded-xl border bg-slate-50 p-3 text-[13px] leading-relaxed text-slate-700">
            {TRAINING_SECTIONS.map((s) => (
              <div key={s.no}>
                <h4 className="font-bold text-slate-900">{s.no}. {s.title}</h4>
                <ClauseList items={s.clauses} />
              </div>
            ))}
            <p className="font-bold text-slate-900">{TRAINING_SECTIONS.length + 1}. {TRAINING_SATISFACTION}</p>
          </div>

          <div className="rounded-xl border-2 p-3" style={{ borderColor: '#e3e8f0' }}>
            <h4 className="mb-2 text-sm font-bold" style={{ color: '#14223a' }}>4. פרטי מקבל ההדרכה</h4>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Field label="שם ומשפחה *" value={recipient} onChange={setRecipient} />
              <Field label="תעודת זהות *" value={idNumber} onChange={setIdNumber} />
            </div>
            <label className="mt-2 block text-xs font-semibold text-slate-600">יחס קרבה לזכאי *</label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {TRAINING_RELATIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRelation(r)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    relation === r ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white text-slate-700'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <div className="mt-3 space-y-1">
              <label className="text-xs font-semibold text-slate-600">חתימה *</label>
              <SignaturePad onChange={setSignature} />
            </div>
          </div>

          <div className="rounded-xl border p-3" style={{ borderColor: '#e3e8f0' }}>
            <h4 className="mb-1 text-sm font-bold" style={{ color: '#14223a' }}>5. פרטי מבצע ההדרכה</h4>
            <p className="text-[13px] text-slate-700">{technicianName || 'המשתמש המחובר'}</p>
          </div>

          <div className="rounded-xl border p-3" style={{ borderColor: '#e3e8f0' }}>
            <h4 className="mb-1 text-sm font-bold" style={{ color: '#14223a' }}>6. פרטי הערסל שסופק</h4>
            <p className="mb-2 text-xs text-slate-500">למלא את שלושת השדות, או לצרף צילום של הערסל או של התווית.</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Field label="יצרן הערסל" value={slingManufacturer} onChange={setSlingManufacturer} />
              <Field label="תאריך ייצור" value={slingDate} onChange={setSlingDate} />
              <Field label='מס"ד' value={slingSerial} onChange={setSlingSerial} />
            </div>
            <div className="mt-2">
              <PhotoSlotInput
                slot={{ key: 'sling', label: 'או צילום הערסל', required: false, hint: 'התווית עם היצרן, תאריך הייצור והמס"ד' }}
                value={slingPhoto}
                onChange={setSlingPhoto}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <div className="me-auto flex items-center gap-2 text-xs">
            {gate.ok ? (
              <span className="flex items-center gap-1 font-semibold text-emerald-700">
                <Check className="h-4 w-4" />
                מוכן לשמירה
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-700">
                <AlertTriangle className="h-4 w-4" />
                {gate.reason}
              </span>
            )}
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

function ClauseList({ items }: { items: TrainingClause[] }) {
  return (
    <ul className="mt-1 space-y-0.5 ps-3">
      {items.map((c) => (
        <li key={c.mark}>
          <span className="me-1 font-semibold">{c.mark}.</span>
          {c.text}
          {c.sub && <ClauseList items={c.sub} />}
        </li>
      ))}
    </ul>
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
