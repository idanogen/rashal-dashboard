import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { SignaturePad } from '@/components/crane/SignaturePad';
import { PhotoSlotInput } from './PhotoSlotInput';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  AlertTriangle, ArrowLeft, ArrowRight, FileCheck2, Loader2, ShieldCheck,
} from 'lucide-react';
import type { FormDefinition, FormContext, FormLine, FormValues, FormField } from '@/lib/forms/types';
import type { PhotoImages, SignatureImages, SignerNames } from '@/lib/forms/render';
import {
  buildInitialValues, invalidIds, isValidIsraeliId, missingPhotos, missingRequired,
} from '@/lib/forms/prefill';

type Step = 'fill' | 'sign' | 'photos';

interface SignFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  definition: FormDefinition;
  context: FormContext;
  lines?: FormLine[];
  driverName: string;
  submitting?: boolean;
  onSubmit: (payload: {
    values: FormValues;
    signatures: SignatureImages;
    signerNames: SignerNames;
    photos: PhotoImages;
  }) => Promise<void> | void;
}

/**
 * מילוי וחתימה של טופס קופת חולים באפליקציית הנהג.
 *
 * שני שלבים ולא מסך אחד ארוך: בטלפון, טופס עם עשרים שדות וחתימה בתחתית
 * גורם לנהג לגלול הלוך ושוב, והחתימה נחתמת לפני שהשדות מולאו. השלב השני
 * נפתח רק כששדות החובה מלאים.
 */
export function SignFormDialog({
  open, onOpenChange, definition, context, lines = [], driverName, submitting, onSubmit,
}: SignFormDialogProps) {
  // ⭐ השלבים נגזרים מההגדרה: טופס הפורטל של כללית הוא צילום בלבד, ובטפסים
  // עם שטר חוב יש שלב צילום אחרי החתימה.
  const steps: Step[] = [
    ...(definition.sections.length ? (['fill'] as Step[]) : []),
    ...(definition.signatures.length ? (['sign'] as Step[]) : []),
    ...(definition.photos?.length ? (['photos'] as Step[]) : []),
  ];
  const [step, setStep] = useState<Step>(steps[0] ?? 'fill');
  const [values, setValues] = useState<FormValues>(() => buildInitialValues(definition, context, lines));
  const [sigs, setSigs] = useState<SignatureImages>({});
  const [photos, setPhotos] = useState<PhotoImages>({});
  const [names, setNames] = useState<SignerNames>({
    customer: context.customerName, driver: driverName, guarantor: '',
  });
  const [touched, setTouched] = useState(false);

  const missing = useMemo(() => missingRequired(definition, values), [definition, values]);
  const badIds = useMemo(() => invalidIds(definition, values), [definition, values]);
  const photosMissing = missingPhotos(definition, photos);
  const signaturesReady = definition.signatures.every((s) => !s.required || !!sigs[s.key]);

  const setValue = (key: string, v: string | boolean) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  const idx = steps.indexOf(step);
  const isLast = idx === steps.length - 1;

  const canLeave = (from: Step): boolean => {
    if (from === 'fill') {
      setTouched(true);
      if (missing.length) {
        toast.error(`חסרים ${missing.length} שדות חובה`, { description: missing.slice(0, 3).join(' · ') });
        return false;
      }
      if (badIds.length) {
        toast.error('מספר תעודת זהות לא תקין', { description: badIds.join(' · ') });
        return false;
      }
    }
    if (from === 'sign' && !signaturesReady) {
      toast.error('חסרה חתימה');
      return false;
    }
    if (from === 'photos' && photosMissing.length) {
      toast.error('חסר צילום', { description: photosMissing.join(' · ') });
      return false;
    }
    return true;
  };

  const next = () => {
    if (!canLeave(step)) return;
    setStep(steps[idx + 1]);
  };

  const handleSubmit = async () => {
    if (!canLeave(step)) return;
    await onSubmit({ values, signatures: sigs, signerNames: names, photos });
  };

  return (
    <Dialog open={open} onOpenChange={submitting ? undefined : onOpenChange}>
      <DialogContent
        dir="rtl"
        className="flex h-[92vh] max-h-[92vh] w-[96vw] max-w-2xl flex-col gap-0 overflow-hidden p-0"
        // ⭐ בלי מיקוד אוטומטי: השדה הראשון הוא "שם הספק" לקריאה בלבד, והמיקוד
        // סימן אותו והקפיץ מקלדת בטלפון עוד לפני שהטכנאי התחיל.
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="shrink-0 space-y-0 border-b p-4 pb-3 text-start">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="truncate text-base">{definition.title}</DialogTitle>
              <p className="mt-0.5 truncate text-xs text-slate-500">
                {definition.fundLabel} · {context.customerName}
              </p>
            </div>
            <div
              className="shrink-0 rounded-md px-2 py-1 text-xs font-bold text-white"
              style={{ backgroundColor: definition.brandColor }}
            >
              {step === 'fill' ? 'מילוי' : step === 'sign' ? 'חתימה' : 'צילום'}
            </div>
          </div>

          {definition.isDemo && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
              <AlertTriangle className="mt-px h-4 w-4 shrink-0" />
              <span>
                טופס הדגמה. אינו הטופס הרשמי של {definition.fundLabel} ואינו מיועד לחתימה מול לקוח.
              </span>
            </div>
          )}
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {step === 'photos' ? (
            <div className="space-y-4">
              {(definition.photos ?? []).map((slot) => (
                <PhotoSlotInput
                  key={slot.key}
                  slot={slot}
                  value={photos[slot.key] ?? null}
                  disabled={submitting}
                  onChange={(v) => setPhotos((p) => ({ ...p, [slot.key]: v }))}
                />
              ))}
            </div>
          ) : step === 'fill' ? (
            <div className="space-y-5">
              {definition.sections.map((section, si) => (
                <section key={section.title}>
                  <div className="mb-2.5 flex items-center gap-2">
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded text-[11px] font-bold text-white"
                      style={{ backgroundColor: definition.brandColor }}
                    >
                      {si + 1}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900">{section.title}</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {section.fields.map((field) => (
                      <FieldInput
                        key={field.key}
                        field={field}
                        value={values[field.key]}
                        invalid={
                          touched &&
                          ((field.required && !String(values[field.key] ?? '').trim()) ||
                            (field.type === 'id' && !isValidIsraeliId(String(values[field.key] ?? ''))))
                        }
                        onChange={(v) => setValue(field.key, v)}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="space-y-5">
              {definition.declarations?.length ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 flex items-center gap-1.5 text-sm font-bold text-slate-900">
                    <ShieldCheck className="h-4 w-4" />
                    {definition.declarationStyle === 'plain' ? 'הצהרה והתחייבות' : 'הצהרת הלקוח'}
                  </div>
                  <ol className="space-y-1.5">
                    {definition.declarations.map((d, i) => (
                      <li key={i} className="flex gap-2 text-xs leading-relaxed text-slate-700">
                        {definition.declarationStyle !== 'plain' && (
                          <span className="font-bold" style={{ color: definition.brandColor }}>
                            {'אבגדהוזחט'[i] ?? i + 1}.
                          </span>
                        )}
                        <span>{d}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}

              {definition.signatures.map((slot) => (
                <div key={slot.key} className="space-y-2.5">
                  <div>
                    <Label className="mb-1 block text-xs text-slate-500">{slot.nameLabel}</Label>
                    <Input
                      value={names[slot.key] ?? ''}
                      readOnly={slot.key === 'driver'}
                      onChange={(e) => setNames((n) => ({ ...n, [slot.key]: e.target.value }))}
                      className={cn('h-10 text-start', slot.key === 'driver' && 'bg-slate-50')}
                    />
                  </div>
                  <Label className="block text-xs text-slate-500">
                    {slot.label}
                    {slot.required && <span className="text-red-600"> *</span>}
                  </Label>
                  <SignaturePad onChange={(v) => setSigs((p) => ({ ...p, [slot.key]: v }))} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t bg-white p-3">
          <div className="flex items-center gap-2">
            {idx === 0 ? (
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting} className="h-11">
                ביטול
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => setStep(steps[idx - 1])}
                disabled={submitting}
                className="h-11 gap-1.5"
              >
                <ArrowRight className="h-4 w-4" />
                חזרה
              </Button>
            )}
            {isLast ? (
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="h-11 flex-1 gap-1.5 bg-emerald-600 text-base hover:bg-emerald-700"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    שומר את הטופס
                  </>
                ) : (
                  <>
                    <FileCheck2 className="h-4 w-4" />
                    {definition.photoOnly ? 'שמור את הטופס' : 'סיים וחתום'}
                  </>
                )}
              </Button>
            ) : (
              <Button onClick={next} className="h-11 flex-1 gap-1.5 text-base">
                {steps[idx + 1] === 'sign' ? 'המשך לחתימה' : 'המשך לצילום'}
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FieldInput({
  field, value, invalid, onChange,
}: {
  field: FormField;
  value: string | boolean | undefined;
  invalid?: boolean;
  onChange: (v: string | boolean) => void;
}) {
  const span = field.span ?? 1;
  const wrapper = span >= 2 ? 'col-span-2' : '';
  const str = typeof value === 'boolean' ? '' : String(value ?? '');

  return (
    <div className={wrapper}>
      <Label className="mb-1 block text-xs text-slate-500">
        {field.label}
        {field.required && <span className="text-red-600"> *</span>}
      </Label>

      {field.type === 'radio' && field.options ? (
        <div className="flex flex-wrap gap-1.5">
          {field.options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={cn(
                'h-10 rounded-lg border px-3 text-sm transition-colors',
                str === opt.value
                  ? 'border-slate-900 bg-slate-900 font-semibold text-white'
                  : 'border-slate-200 bg-white text-slate-700',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : field.type === 'textarea' ? (
        <Textarea
          value={str}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          readOnly={field.readOnly}
          rows={3}
          className={cn('text-start', invalid && 'border-red-400', field.readOnly && 'bg-slate-50')}
        />
      ) : (
        <Input
          value={str}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          readOnly={field.readOnly}
          type={field.type === 'date' ? 'date' : 'text'}
          inputMode={
            field.type === 'tel' || field.type === 'id' || field.type === 'number' || field.type === 'money'
              ? 'numeric'
              : undefined
          }
          className={cn(
            'h-10 text-start',
            invalid && 'border-red-400',
            field.readOnly && 'bg-slate-50 text-slate-500',
          )}
        />
      )}

      {field.hint && <p className="mt-1 text-[11px] text-slate-400">{field.hint}</p>}
    </div>
  );
}
