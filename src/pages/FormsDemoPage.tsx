import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ExternalLink, FlaskConical, Play, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SignFlow } from '@/components/forms/SignFlow';
import { FormLogo } from '@/components/forms/FormLogo';
import { CraneTrainingDialog } from '@/components/crane/CraneTrainingDialog';
import { FORM_DEFINITIONS, FORM_KIND_LABEL, getFormByKey } from '@/lib/forms/registry';
import { buildContext } from '@/lib/forms/prefill';
import { generateFormPdf } from '@/lib/forms/render';
import { DEMO_CUSTOMER, DEMO_DRIVER, demoEntries, demoSource } from '@/lib/forms-demo';
import type { FormKind } from '@/lib/forms/types';

/**
 * הדגמת כל הטפסים (25/10/2026), לפני פגישת המסירה עם עמי.
 *
 * 🔴 **שום דבר לא נשמר.** אותה זרימת מילוי וחתימה שהטכנאי עובר, ואותו PDF
 * שנכנס לפריוריטי, אבל בלי `saveSignedForm`, בלי `crane_forms` ובלי אירוע
 * לכרטיס הלקוח. ה-PDF נוצר בדפדפן ומוצג כאן בלבד.
 */

const KIND_ORDER: FormKind[] = ['delivery', 'return', 'repair'];

type Result = { title: string; url: string };

export function FormsDemoPage() {
  const entries = useMemo(() => demoEntries(FORM_DEFINITIONS), []);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [craneOpen, setCraneOpen] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  // כתובת blob חיה עד שמחליפים אותה. בלי שחרור היא נשארת בזיכרון של הלשונית.
  useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);

  const def = openKey ? getFormByKey(openKey) : null;
  if (def) {
    const src = demoSource(def);
    const ctx = buildContext(src, DEMO_DRIVER);
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
        <SignFlow
          key={def.key}
          definition={def}
          context={ctx}
          lines={src.lines}
          driverName={DEMO_DRIVER}
          onCancel={() => setOpenKey(null)}
          onSubmit={async (p) => {
            const blob = await generateFormPdf(def, p.values, p.signatures, p.signerNames,
              { customerName: DEMO_CUSTOMER, orderNumber: src.docNumber ?? undefined, driverName: DEMO_DRIVER, signedAt: new Date() },
              p.photos);
            setResult({ title: def.title, url: URL.createObjectURL(blob) });
            setOpenKey(null);
          }}
        />
      </div>
    );
  }

  return (
    <div dir="rtl" className="mx-auto max-w-5xl space-y-5 px-4 py-6 md:px-6">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
          <FlaskConical className="h-5 w-5 text-primary" />
        </div>
        <h1 className="text-xl font-bold">הדגמת טפסים</h1>
      </div>

      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-[15px] leading-relaxed text-amber-900">
        <b>מצב הדגמה. שום דבר לא נשמר.</b> כל טופס כאן עובר בדיוק את מה שהטכנאי עובר מול הלקוח: מילוי, חתימה
        באצבע וצילום, ובסוף נוצר אותו PDF שנכנס לכרטיס הלקוח בפריוריטי. הלקוח ({DEMO_CUSTOMER}) והמכשירים הם
        דמה. לא נכתב כלום למערכת או לפריוריטי, ולא יוצאת שום הודעה.
      </div>

      {result && (
        <section className="space-y-3 rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-[15px] font-semibold">ה-PDF שהיה נכנס לפריוריטי: {result.title}</div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-1" onClick={() => window.open(result.url, '_blank')}>
                <ExternalLink className="h-4 w-4" /> פתיחה בלשונית
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setResult(null)}>סגירה</Button>
            </div>
          </div>
          <iframe title="PDF" src={result.url} className="h-[75vh] w-full rounded-lg border bg-white" />
        </section>
      )}

      {KIND_ORDER.map((kind) => (
        <section key={kind} className="space-y-2">
          <h2 className="text-sm font-bold text-muted-foreground">{FORM_KIND_LABEL[kind]}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {entries.filter((e) => e.kind === kind).map((e) => (
              <button
                key={e.key}
                type="button"
                onClick={() => setOpenKey(e.key)}
                className="flex items-center gap-3 rounded-xl border bg-card p-4 text-start transition-colors hover:bg-muted/50"
              >
                <div className="flex w-16 shrink-0 items-center justify-center">
                  <FormLogo formKey={e.key} className="max-h-8 w-full object-contain" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-semibold">{e.fund}</div>
                  <div className="line-clamp-2 text-sm text-muted-foreground">{e.title}</div>
                  {e.photoOnly && <div className="text-xs text-muted-foreground">צילום של טופס הנייר</div>}
                </div>
                <Play className="h-4 w-4 shrink-0 text-muted-foreground rtl:rotate-180" />
              </button>
            ))}
          </div>
        </section>
      ))}

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-muted-foreground">מנוף</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <button
            type="button"
            onClick={() => setCraneOpen(true)}
            className="flex items-center gap-3 rounded-xl border bg-card p-4 text-start transition-colors hover:bg-muted/50"
          >
            <Wrench className="h-6 w-6 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-semibold">אישור קבלת הדרכה</div>
              <div className="text-sm text-muted-foreground">באספקת מנוף, חובה לפני סגירה</div>
            </div>
            <Play className="h-4 w-4 shrink-0 text-muted-foreground rtl:rotate-180" />
          </button>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-4 text-sm leading-relaxed text-muted-foreground">
        <div className="mb-1 flex items-center gap-1.5 font-semibold text-foreground">
          <ArrowRight className="h-4 w-4 rtl:rotate-180" /> מה קורה בשטח אחרי החתימה
        </div>
        ה-PDF עולה לאחסון ונכנס לכרטיס הלקוח בפריוריטי תוך כמה דקות. טופס אספקה מצורף גם לתעודת המשלוח. ביומן
        הסדרן מופיע על העצירה צ'יפ "נחתם" שנפתח בלחיצה. אספקת מנוף שנסגרה בלי אישור הדרכה מסומנת "בלי הדרכה",
        ונשלחת עליה התרעה במייל.
      </section>

      <CraneTrainingDialog
        open={craneOpen}
        onOpenChange={setCraneOpen}
        craneSerial="DEMO-G175-001"
        customerName={DEMO_CUSTOMER}
        customerNumber="DEMO-1"
        technicianName={DEMO_DRIVER}
        onDemoSubmit={(pdf) => setResult({ title: 'אישור קבלת הדרכה, מנוף', url: URL.createObjectURL(pdf) })}
      />
    </div>
  );
}
