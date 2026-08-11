import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { SignaturePad } from './SignaturePad';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  AlertTriangle, ArrowLeft, ArrowRight, FileCheck2, Loader2, ShieldCheck,
} from 'lucide-react';
import type { FormDefinition, FormContext, FormValues, FormField } from '@/lib/forms/types';
import { buildInitialValues, missingRequired } from '@/lib/forms/prefill';

interface SignFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  definition: FormDefinition;
  context: FormContext;
  driverName: string;
  submitting?: boolean;
  onSubmit: (payload: {
    values: FormValues;
    signatures: { customer?: string | null; driver?: string | null };
    signerNames: { customer?: string; driver?: string };
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
  open, onOpenChange, definition, context, driverName, submitting, onSubmit,
}: SignFormDialogProps) {
  const [step, setStep] = useState<'fill' | 'sign'>('fill');
  const [values, setValues] = useState<FormValues>(() => buildInitialValues(definition, context));
  const [customerSig, setCustomerSig] = useState<string | null>(null);
  const [driverSig, setDriverSig] = useState<string | null>(null);
  const [customerSigner, setCustomerSigner] = useState(context.customerName);
  const [touched, setTouched] = useState(false);

  const missing = useMemo(() => missingRequired(definition, values), [definition, values]);

  const needsCustomerSig = definition.signatures.some((s) => s.key === 'customer' && s.required);
  const needsDriverSig = definition.signatures.some((s) => s.key === 'driver' && s.required);
  const signaturesReady =
    (!needsCustomerSig || !!customerSig) && (!needsDriverSig || !!driverSig);

  const setValue = (key: string, v: string | boolean) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  const goToSign = () => {
    setTouched(true);
    if (missing.length) {
      toast.error(`חסרים ${missing.length} שדות חובה`, { description: missing.slice(0, 3).join(' · ') });
      return;
    }
    setStep('sign');
  };

  const handleSubmit = async () => {
    if (!signaturesReady) {
      toast.error('חסרה חתימה');
      return;
    }
    await onSubmit({
      values,
      signatures: { customer: customerSig, driver: driverSig },
      signerNames: { customer: customerSigner, driver: driverName },
    });
  };

  return (
    <Dialog open={open} onOpenChange={submitting ? undefined : onOpenChange}>
      <DialogContent
        dir="rtl"
        className="flex h-[92vh] max-h-[92vh] w-[96vw] max-w-2xl flex-col gap-0 overflow-hidden p-0"
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
              {step === 'fill' ? 'מילוי' : 'חתימה'}
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
          {step === 'fill' ? (
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
                        invalid={touched && field.required && !String(values[field.key] ?? '').trim()}
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
                    הצהרת הלקוח
                  </div>
                  <ol className="space-y-1.5">
                    {definition.declarations.map((d, i) => (
                      <li key={i} className="flex gap-2 text-xs leading-relaxed text-slate-700">
                        <span className="font-bold" style={{ color: definition.brandColor }}>
                          {'אבגדהוזחט'[i] ?? i + 1}.
                        </span>
                        <span>{d}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}

              {definition.signatures.map((slot) => (
                <div key={slot.key} className="space-y-2.5">
                  {slot.key === 'customer' && (
                    <div>
                      <Label className="mb-1 block text-xs text-slate-500">{slot.nameLabel}</Label>
                      <Input
                        value={customerSigner}
                        onChange={(e) => setCustomerSigner(e.target.value)}
                        className="h-10 text-start"
                      />
                    </div>
                  )}
                  {slot.key === 'driver' && (
                    <div>
                      <Label className="mb-1 block text-xs text-slate-500">{slot.nameLabel}</Label>
                      <Input value={driverName} readOnly className="h-10 bg-slate-50 text-start" />
                    </div>
                  )}
                  <SignaturePad
                    label={slot.label}
                    required={slot.required}
                    disabled={submitting}
                    onChange={slot.key === 'customer' ? setCustomerSig : setDriverSig}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t bg-white p-3">
          {step === 'fill' ? (
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="h-11">
                ביטול
              </Button>
              <Button onClick={goToSign} className="h-11 flex-1 gap-1.5 text-base">
                המשך לחתימה
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setStep('fill')}
                disabled={submitting}
                className="h-11 gap-1.5"
              >
                <ArrowRight className="h-4 w-4" />
                חזרה
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!signaturesReady || submitting}
                className={cn('h-11 flex-1 gap-1.5 text-base', 'bg-emerald-600 hover:bg-emerald-700')}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    שומר את הטופס
                  </>
                ) : (
                  <>
                    <FileCheck2 className="h-4 w-4" />
                    סיים וחתום
                  </>
                )}
              </Button>
            </div>
          )}
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
