import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CheckCircle2, FileSignature, TriangleAlert, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { SignFlow } from '@/components/forms/SignFlow';
import { FormLogo } from '@/components/forms/FormLogo';
import { CraneChecklistDialog } from '@/components/crane/CraneChecklistDialog';
import { CraneTrainingDialog } from '@/components/crane/CraneTrainingDialog';
import { formsClient, openedFromApp } from '@/lib/forms/client';
import { loadFormContext, type LoadedFormContext } from '@/lib/forms/context';
import { FORM_KIND_LABEL, findForm, formKindForStop, noFormReason } from '@/lib/forms/registry';
import { saveSignedForm } from '@/lib/forms/save';

/**
 * עמוד החתימה על עצירה: `/sign/<stop_id>`.
 *
 * נפתח מהאפליקציה של הטכנאי (עם `#t=`, ראה `lib/forms/client.ts`) או ממסך
 * הנהג בווב (עם ההתחברות הרגילה).
 *
 * 🔴 17/10/2026 (עידן): **לטכנאי אין בחירה של טופס.** הטופס נקבע לפי סוג
 * העצירה והקופה בפריוריטי בלבד. כשאין טופס מתאים (קופה לא רשומה, משרד
 * הביטחון) הטכנאי רואה הסבר ולא רשימה, והתיקון הוא בפריוריטי, במשרד.
 *
 * ⭐ `?return=<url>`: לאן לחזור בסוף. האפליקציה מעבירה `rashaldriver://...`.
 */
export function SignStopPage() {
  const { stopId = '' } = useParams();
  const [search] = useSearchParams();
  const returnUrl = search.get('return');
  const navigate = useNavigate();
  const location = useLocation();
  // ⭐ נקרא פעם אחת לפני כל שליפה: בולע את `#t=` ומוחק אותו מההיסטוריה.
  const client = useMemo(() => formsClient(), []);

  const [ctx, setCtx] = useState<LoadedFormContext | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [craneOpen, setCraneOpen] = useState(false);
  const [craneDone, setCraneDone] = useState(false);

  useEffect(() => {
    let alive = true;
    loadFormContext(stopId, undefined, client)
      .then((c) => {
        if (!alive) return;
        if (!c) setLoadError('העצירה לא נמצאה');
        else setCtx(c);
      })
      .catch((e: Error) => {
        if (!alive) return;
        // בלי התחברות (נפתח בדפדפן רגיל, לא מהאפליקציה): הפונקציה סגורה ל-anon.
        if (!openedFromApp() && /permission denied/i.test(e.message)) return setNeedsLogin(true);
        setLoadError(
          /not authorized|JWT|jwt/.test(e.message)
            ? 'אין הרשאה לעצירה הזו. ייתכן שההתחברות פגה: לסגור ולפתוח שוב מהאפליקציה.'
            : e.message,
        );
      });
    return () => { alive = false; };
  }, [stopId, client]);

  const kind = ctx ? formKindForStop(ctx.sourceType) : null;
  const definition = ctx && kind ? findForm(ctx.healthFund, kind) : null;
  const craneSigned = !!ctx?.crane && (craneDone || ctx.craneSigned.some((c) => c.formType === ctx.crane?.kind));

  const submit: React.ComponentProps<typeof SignFlow>['onSubmit'] = async (p) => {
    if (!ctx || !definition) return;
    setSaving(true);
    try {
      const where: { lat: number; lng: number } | null = await new Promise((resolve) => {
        if (!navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => resolve(null),
          { timeout: 5000, maximumAge: 120000 },
        );
      });
      await saveSignedForm(
        {
          definition, values: p.values, signatures: p.signatures, signerNames: p.signerNames, photos: p.photos,
          stopId: ctx.stopId, healthFund: ctx.healthFund,
          meta: {
            customerName: ctx.context.customerName, orderNumber: ctx.docNumber ?? undefined,
            driverName: ctx.driver, signedAt: new Date(), location: where,
          },
        },
        client,
      );
      setOpen(false);
      setDone(true);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (open && ctx && definition) {
    return (
      <SignFlow
        key={definition.key}
        definition={definition}
        context={ctx.context}
        lines={ctx.lines}
        driverName={ctx.driver}
        submitting={saving}
        onCancel={() => setOpen(false)}
        onSubmit={submit}
      />
    );
  }

  const lastSigned = ctx?.signed.length ? ctx.signed[ctx.signed.length - 1] : null;

  return (
    <div dir="rtl" className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-4 md:px-6">
          <FileSignature className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold text-foreground">חתימה על טופס</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-5 md:px-6">
        {needsLogin && (
          <section className="space-y-3 rounded-xl border bg-card p-5">
            <p className="text-[15px] text-foreground">כדי לחתום על טופס צריך להתחבר למערכת.</p>
            <Button className="h-12 w-full text-base" onClick={() => navigate('/login', { state: { from: location } })}>
              התחברות
            </Button>
          </section>
        )}

        {loadError && (
          <section className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-[15px] text-foreground">
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <span>{loadError}</span>
          </section>
        )}

        {!ctx && !loadError && !needsLogin && (
          <div className="space-y-3">
            <div className="h-24 animate-pulse rounded-xl bg-muted" />
            <div className="h-32 animate-pulse rounded-xl bg-muted" />
          </div>
        )}

        {ctx && (
          <section className="rounded-xl border bg-card p-5">
            <div className="text-xl font-semibold text-foreground">{ctx.context.customerName}</div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span>{kind ? FORM_KIND_LABEL[kind] : 'משימה'}</span>
              {ctx.docNumber && <bdi dir="ltr">{ctx.docNumber}</bdi>}
              {ctx.context.city && <span>{ctx.context.city}</span>}
            </div>
          </section>
        )}

        {done ? (
          <section className="space-y-4 rounded-xl border bg-card p-6 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
            <div>
              <div className="text-lg font-semibold text-foreground">הטופס נשמר</div>
              <p className="mt-1 text-[15px] text-muted-foreground">הוא יצורף לכרטיס הלקוח בפריוריטי תוך כמה דקות.</p>
            </div>
            {returnUrl && (
              <Button className="h-12 w-full text-base" onClick={() => { window.location.href = returnUrl; }}>
                חזרה לאפליקציה
              </Button>
            )}
          </section>
        ) : ctx && kind ? (
          definition ? (
            <section className="rounded-xl border bg-card p-5">
              <div className="flex items-center gap-4">
                <FormLogo formKey={definition.key} className="h-10 w-auto shrink-0" />
                <div className="min-w-0">
                  <div className="text-[15px] font-semibold text-foreground">{definition.title}</div>
                  <div className="text-sm text-muted-foreground">
                    {definition.photoOnly ? 'צילום של הטופס החתום' : 'מילוי וחתימה על המסך'}
                  </div>
                </div>
              </div>
              {lastSigned && (
                <p className="mt-4 flex items-center gap-1.5 text-sm text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  כבר נחתם טופס על העצירה הזו,{' '}
                  <bdi>{new Date(lastSigned.signedAt).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })}</bdi>
                </p>
              )}
              <Button className="mt-5 h-12 w-full text-base" onClick={() => setOpen(true)}>
                {lastSigned ? 'חתימה על טופס נוסף' : definition.photoOnly ? 'צילום הטופס' : 'התחלת מילוי'}
              </Button>
            </section>
          ) : (
            <section className="flex items-start gap-3 rounded-xl border bg-card p-5 text-[15px] text-foreground">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <div className="font-semibold">{noFormReason(ctx.healthFund, kind)}</div>
                <p className="mt-1 text-muted-foreground">
                  אין טופס קופה לחתימה בעצירה הזו. אם הקופה רשומה לא נכון, המשרד מתקן אותה בפריוריטי.
                </p>
              </div>
            </section>
          )
        ) : ctx ? (
          <p className="text-[15px] text-muted-foreground">לעצירה מהסוג הזה אין טופס קופה.</p>
        ) : null}

        {ctx?.crane && !done && (
          <section className="rounded-xl border bg-card p-5">
            <div className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
              <Wrench className="h-4 w-4 text-muted-foreground" />
              {ctx.crane.kind === 'inspection' ? 'רשימת בדיקה לטכנאי, מנוף' : 'אישור קבלת הדרכה, מנוף'}
              {ctx.crane.model && <bdi dir="ltr" className="text-muted-foreground">{ctx.crane.model}</bdi>}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">חובה לפני סימון בוצע.</p>
            {craneSigned ? (
              <p className="mt-4 flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                טופס המנוף נחתם
              </p>
            ) : (
              <Button variant="outline" className="mt-4 h-12 w-full text-base" onClick={() => setCraneOpen(true)}>
                פתיחת טופס המנוף
              </Button>
            )}
          </section>
        )}
      </main>

      {ctx?.crane?.kind === 'inspection' && (
        <CraneChecklistDialog
          open={craneOpen} onOpenChange={setCraneOpen} craneSerial={ctx.crane.serial}
          customerName={ctx.context.customerName} customerNumber={ctx.customerNumber} stopId={ctx.stopId}
          serviceCallId={ctx.serviceCallId} technicianName={ctx.driver} onSaved={() => setCraneDone(true)}
        />
      )}
      {ctx?.crane?.kind === 'training' && (
        <CraneTrainingDialog
          open={craneOpen} onOpenChange={setCraneOpen} craneSerial={ctx.crane.serial}
          customerName={ctx.context.customerName} customerNumber={ctx.customerNumber} stopId={ctx.stopId}
          orderId={ctx.orderId} technicianName={ctx.driver} onSaved={() => setCraneDone(true)}
        />
      )}
    </div>
  );
}
