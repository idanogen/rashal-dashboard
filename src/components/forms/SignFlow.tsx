import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Check, FileCheck2, Loader2, Plus, ShieldCheck } from 'lucide-react';
import { SignaturePad } from '@/components/crane/SignaturePad';
import { PhotoSlotInput } from './PhotoSlotInput';
import { FormLogo } from './FormLogo';
import type { FormDefinition, FormContext, FormField, FormLine, FormValues } from '@/lib/forms/types';
import { buildFormHtml, type PhotoImages, type SignatureImages, type SignerNames } from '@/lib/forms/render';
import {
  buildInitialValues, invalidIds, isValidIsraeliId, missingPhotos, missingRequired,
} from '@/lib/forms/prefill';

/**
 * מילוי וחתימה של טופס קופה, מסך מלא (16-17/10/2026).
 *
 * ⭐ מסך ולא חלון: בטאבלט של הטכנאי החלון הקודם ישב באמצע דף ריק, קטן וצפוף
 * (עידן: "הנראות הכללית של הטופס נראית לא טוב בכלל"). כאן: כותרת קבועה עם
 * הלוגו של הקופה והשלבים, שדות גדולים למגע, שתי עמודות בטאבלט, ופס פעולה
 * קבוע למטה.
 * ⭐ השלב האחרון מראה ללקוח את הטופס עצמו (`buildFormHtml`, ההעתק של הטופס
 * המקורי) לפני השמירה, כדי שיראה בדיוק על מה הוא חתם.
 * ⭐ שורות מכשיר ריקות (2 ומעלה) מוסתרות עד "הוספת מכשיר": בטופס יש ארבע
 * או חמש שורות, וברוב הביקורים יש מכשיר אחד.
 */

export type Step = 'fill' | 'sign' | 'photos' | 'review';
const STEP_LABEL: Record<Step, string> = { fill: 'פרטים', sign: 'חתימה', photos: 'צילום', review: 'אישור' };

/** שדות ששייכים לשורה N בטבלה חוזרת (`dev2Name`, `item3Model`, `eq4Cost`, `fault5`...). */
function rowOf(key: string): number | null {
  const m = key.match(/^(?:dev|item|eq|fault|work|catalog|cost)(\d)/);
  return m ? Number(m[1]) : null;
}

export interface SignFlowProps {
  definition: FormDefinition;
  context: FormContext;
  lines?: FormLine[];
  driverName: string;
  submitting?: boolean;
  onCancel: () => void;
  /** לתצוגה המקדימה בלבד: לפתוח ישר בשלב מסוים. */
  initialStep?: Step;
  onSubmit: (payload: {
    values: FormValues;
    signatures: SignatureImages;
    signerNames: SignerNames;
    photos: PhotoImages;
  }) => Promise<void> | void;
}

export function SignFlow({
  definition, context, lines = [], driverName, submitting, onCancel, onSubmit, initialStep,
}: SignFlowProps) {
  const steps: Step[] = [
    ...(definition.sections.length ? (['fill'] as Step[]) : []),
    ...(definition.signatures.length ? (['sign'] as Step[]) : []),
    ...(definition.photos?.length ? (['photos'] as Step[]) : []),
    'review',
  ];
  const [step, setStep] = useState<Step>(initialStep && steps.includes(initialStep) ? initialStep : steps[0]);
  const [values, setValues] = useState<FormValues>(() => buildInitialValues(definition, context, lines));
  const [sigs, setSigs] = useState<SignatureImages>({});
  const [photos, setPhotos] = useState<PhotoImages>({});
  const [names, setNames] = useState<SignerNames>({ customer: context.customerName, driver: driverName, guarantor: '' });
  const [touched, setTouched] = useState(false);
  // כמה שורות מכשיר מוצגות: לפחות 1, ולפחות כמספר השורות שהגיעו מפריוריטי.
  const [rowsShown, setRowsShown] = useState(() => Math.max(1, lines.length));

  const missing = useMemo(() => missingRequired(definition, values), [definition, values]);
  const badIds = useMemo(() => invalidIds(definition, values), [definition, values]);
  const idx = steps.indexOf(step);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [step]);

  const setValue = (key: string, v: string | boolean) => setValues((p) => ({ ...p, [key]: v }));

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
    if (from === 'sign' && !definition.signatures.every((s) => !s.required || !!sigs[s.key])) {
      toast.error('חסרה חתימה');
      return false;
    }
    if (from === 'photos') {
      const m = missingPhotos(definition, photos);
      if (m.length) {
        toast.error('חסר צילום', { description: m.join(' · ') });
        return false;
      }
    }
    return true;
  };

  const next = () => {
    if (canLeave(step)) setStep(steps[idx + 1]);
  };

  const submit = async () => {
    await onSubmit({ values, signatures: sigs, signerNames: names, photos });
  };

  return (
    <div dir="rtl" className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* כותרת: הקופה, הטופס, הלקוח והשלבים */}
      <header className="shrink-0 border-b bg-card">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-3 md:px-6">
          <FormLogo formKey={definition.key} className="h-9 w-auto shrink-0" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold text-foreground md:text-lg">{definition.title}</h1>
            <p className="truncate text-sm text-muted-foreground">{context.customerName}</p>
          </div>
        </div>
        <nav className="mx-auto flex max-w-3xl gap-2 px-4 pb-3 md:px-6" aria-label="שלבים">
          {steps.map((s, i) => (
            <div key={s} className="flex flex-1 flex-col gap-1.5">
              <div className={cn('h-1 rounded-full', i <= idx ? 'bg-primary' : 'bg-border')} />
              <span className={cn('flex items-center gap-1 text-xs font-medium', i === idx ? 'text-foreground' : 'text-muted-foreground')}>
                {i < idx && <Check className="h-3.5 w-3.5 text-primary" />}
                {i + 1}. {STEP_LABEL[s]}
              </span>
            </div>
          ))}
        </nav>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-5 md:px-6 md:py-6">
          {step === 'fill' && (
            <div className="space-y-5">
              {definition.sections.map((section) => {
                const fields = section.fields.filter((f) => {
                  const r = rowOf(f.key);
                  return r == null || r <= rowsShown;
                });
                const repeating = section.fields.some((f) => rowOf(f.key) != null);
                const maxRow = Math.max(0, ...section.fields.map((f) => rowOf(f.key) ?? 0));
                return (
                  <section key={section.title} className="rounded-xl border bg-card p-4 md:p-5">
                    <h2 className="mb-4 text-[15px] font-semibold text-foreground">{section.title}</h2>
                    <div className="grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-2">
                      {fields.map((field) => (
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
                    {repeating && rowsShown < maxRow && (
                      <Button variant="outline" className="mt-4 h-11 gap-1.5" onClick={() => setRowsShown((n) => n + 1)}>
                        <Plus className="h-4 w-4" />
                        הוספת שורה
                      </Button>
                    )}
                  </section>
                );
              })}
            </div>
          )}

          {step === 'sign' && (
            <div className="space-y-5">
              {definition.declarations?.length ? (
                <section className="rounded-xl border bg-card p-4 md:p-5">
                  <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-foreground">
                    <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                    {definition.declarationStyle === 'plain' ? 'הצהרה והתחייבות' : 'הצהרת הלקוח'}
                  </h2>
                  <ol className="space-y-2 text-sm leading-relaxed text-foreground">
                    {definition.declarations.map((d, i) => (
                      <li key={i} className="flex gap-2">
                        {definition.declarationStyle !== 'plain' && (
                          <span className="font-semibold text-muted-foreground">{'אבגדהוזחט'[i]}.</span>
                        )}
                        <span>{d}</span>
                      </li>
                    ))}
                  </ol>
                </section>
              ) : null}

              {definition.signatures.map((slot) => (
                <section key={slot.key} className="rounded-xl border bg-card p-4 md:p-5">
                  <label className="mb-1.5 block text-[13px] font-medium text-foreground">{slot.nameLabel}</label>
                  <Input
                    value={names[slot.key] ?? ''}
                    readOnly={slot.key === 'driver'}
                    onChange={(e) => setNames((n) => ({ ...n, [slot.key]: e.target.value }))}
                    className={cn('h-12 text-base', slot.key === 'driver' && 'bg-muted text-muted-foreground')}
                  />
                  <div className="mb-1.5 mt-4 text-[13px] font-medium text-foreground">
                    {slot.label}
                    {slot.required && <span className="text-destructive"> *</span>}
                  </div>
                  <SignaturePad height={200} onChange={(v) => setSigs((p) => ({ ...p, [slot.key]: v }))} />
                </section>
              ))}
            </div>
          )}

          {step === 'photos' && (
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
          )}

          {step === 'review' && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">כך ייראה הטופס שיישמר ויישלח לקופה. אפשר לחזור ולתקן.</p>
              <FormPreview html={buildFormHtml(definition, values, sigs, names, {
                customerName: context.customerName,
                orderNumber: context.callNumber || undefined,
                driverName,
                signedAt: new Date(),
              }, photos)} />
              {Object.values(photos).filter(Boolean).length > 0 && (
                <p className="text-sm text-muted-foreground">הצילומים יצורפו לקובץ כעמודים נוספים.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* פס פעולה קבוע */}
      <footer className="shrink-0 border-t bg-card">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 md:px-6">
          {idx === 0 ? (
            <Button variant="outline" onClick={onCancel} disabled={submitting} className="h-12 px-5 text-base">
              ביטול
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setStep(steps[idx - 1])} disabled={submitting} className="h-12 gap-1.5 px-5 text-base">
              <ArrowRight className="h-4 w-4" />
              חזרה
            </Button>
          )}
          {step === 'review' ? (
            <Button onClick={submit} disabled={submitting} className="h-12 flex-1 gap-2 text-base">
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileCheck2 className="h-5 w-5" />}
              {submitting ? 'שומר את הטופס' : 'שמירה ושליחה'}
            </Button>
          ) : (
            <Button onClick={next} className="h-12 flex-1 gap-2 text-base">
              המשך ל{STEP_LABEL[steps[idx + 1]]}
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}

/** הטופס כפי שיישמר, מוקטן לרוחב המסך (הדף עצמו 794 פיקסלים). */
function FormPreview({ html }: { html: string }) {
  const outer = useRef<HTMLDivElement | null>(null);
  const inner = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const measure = () => {
      if (!outer.current || !inner.current) return;
      const s = Math.min(1, outer.current.clientWidth / 794);
      setScale(s);
      setHeight(inner.current.scrollHeight * s);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (outer.current) ro.observe(outer.current);
    return () => ro.disconnect();
  }, [html]);

  return (
    <div ref={outer} className="overflow-hidden rounded-xl border bg-white shadow-sm" style={{ height: height || undefined }}>
      <div
        ref={inner}
        style={{ width: 794, transform: `scale(${scale})`, transformOrigin: 'top right' }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
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
  const wide = (field.span ?? 1) >= 2 || field.type === 'textarea' || (field.type === 'radio' && (field.options?.length ?? 0) > 2);
  const str = typeof value === 'boolean' ? '' : String(value ?? '');

  return (
    <div className={cn(wide && 'md:col-span-2')}>
      <label className="mb-1.5 block text-[13px] font-medium text-foreground">
        {field.label}
        {field.required && <span className="text-destructive"> *</span>}
      </label>

      {field.type === 'radio' && field.options ? (
        <div className="flex flex-wrap gap-2">
          {field.options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(str === opt.value ? '' : opt.value)}
              className={cn(
                'min-h-12 rounded-lg border px-4 py-2 text-start text-[15px] transition-colors',
                str === opt.value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input bg-card text-foreground hover:bg-muted',
                invalid && !str && 'border-destructive',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : field.type === 'textarea' ? (
        <Textarea
          value={str}
          dir="auto"
          onChange={(e) => onChange(e.target.value)}
          readOnly={field.readOnly}
          rows={3}
          className={cn('min-h-24 text-base', invalid && 'border-destructive')}
        />
      ) : (
        <Input
          value={str}
          dir="auto"
          onChange={(e) => onChange(e.target.value)}
          readOnly={field.readOnly}
          type={field.type === 'date' ? 'date' : 'text'}
          inputMode={['tel', 'id', 'number', 'money'].includes(field.type) ? 'numeric' : undefined}
          className={cn(
            'h-12 text-base',
            invalid && 'border-destructive',
            field.readOnly && 'bg-muted text-muted-foreground',
          )}
        />
      )}
      <p className={cn('mt-1 min-h-[1lh] text-xs', invalid ? 'text-destructive' : 'text-muted-foreground')}>
        {invalid ? (field.type === 'id' && str ? 'מספר תעודת זהות לא תקין' : 'שדה חובה') : field.hint ?? ''}
      </p>
    </div>
  );
}
