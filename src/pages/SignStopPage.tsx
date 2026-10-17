import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CheckCircle2, FileSignature, Loader2, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { SignFormDialog } from '@/components/forms/SignFormDialog';
import { CraneChecklistDialog } from '@/components/crane/CraneChecklistDialog';
import { CraneTrainingDialog } from '@/components/crane/CraneTrainingDialog';
import { formsClient, openedFromApp } from '@/lib/forms/client';
import { loadFormContext, type LoadedFormContext } from '@/lib/forms/context';
import {
  FORM_DEFINITIONS, FORM_KIND_LABEL, findForm, formKindForStop, getFormByKey, noFormReason,
} from '@/lib/forms/registry';
import { saveSignedForm } from '@/lib/forms/save';

/**
 * עמוד החתימה על עצירה: `/sign/<stop_id>`.
 *
 * נפתח מהאפליקציה של הטכנאי (עם `#t=`, ראה `lib/forms/client.ts`) או ממסך
 * הנהג בווב (עם ההתחברות הרגילה). הטופס נבחר לבד לפי סוג העצירה והקופה,
 * ואפשר להחליף ידנית לטופס אחר מאותו סוג כשהקופה בפריוריטי לא נכונה.
 *
 * ⭐ `?return=<url>`: לאן לחזור בסוף. האפליקציה מעבירה `rashaldriver://...`,
 * והמעבר לכתובת הזו סוגר את הדפדפן ומחזיר אותה לקדמת המסך.
 */
export function SignStopPage() {
  const { stopId = '' } = useParams();
  const [search] = useSearchParams();
  const returnUrl = search.get('return');
  // ⭐ נקרא פעם אחת לפני כל שליפה: בולע את `#t=` ומוחק אותו מההיסטוריה.
  const client = useMemo(() => formsClient(), []);

  const [ctx, setCtx] = useState<LoadedFormContext | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [formKey, setFormKey] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [craneOpen, setCraneOpen] = useState(false);
  const [craneDone, setCraneDone] = useState(false);

  useEffect(() => {
    let alive = true;
    loadFormContext(stopId, undefined, client)
      .then((c) => {
        if (!alive) return;
        if (!c) return setLoadError('העצירה לא נמצאה');
        setCtx(c);
        const kind = formKindForStop(c.sourceType);
        setFormKey(kind ? (findForm(c.healthFund, kind)?.key ?? null) : null);
      })
      .catch((e: Error) => {
        if (!alive) return;
        // בלי התחברות (נפתח בדפדפן רגיל, לא מהאפליקציה): הפונקציה סגורה ל-anon.
        if (!openedFromApp() && /permission denied/i.test(e.message)) {
          setNeedsLogin(true);
          return;
        }
        setLoadError(
          /not authorized|JWT|jwt/.test(e.message)
            ? 'אין הרשאה לעצירה הזו. ייתכן שההתחברות פגה: לסגור ולפתוח שוב מהאפליקציה.'
            : e.message,
        );
      });
    return () => { alive = false; };
  }, [stopId, client]);

  const kind = ctx ? formKindForStop(ctx.sourceType) : null;
  const definition = formKey ? getFormByKey(formKey) : null;
  const sameKind = kind ? FORM_DEFINITIONS.filter((d) => d.kind === kind) : [];

  const finish = () => {
    if (returnUrl) window.location.href = returnUrl;
  };

  const submit: React.ComponentProps<typeof SignFormDialog>['onSubmit'] = async (p) => {
    if (!ctx || !definition) return;
    setSaving(true);
    try {
      let location: { lat: number; lng: number } | null = null;
      try {
        location = await new Promise((resolve) => {
          if (!navigator.geolocation) return resolve(null);
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => resolve(null),
            { timeout: 5000, maximumAge: 120000 },
          );
        });
      } catch { /* מיקום הוא תוספת, לא תנאי */ }

      const res = await saveSignedForm(
        {
          definition,
          values: p.values,
          signatures: p.signatures,
          signerNames: p.signerNames,
          photos: p.photos,
          stopId: ctx.stopId,
          healthFund: ctx.healthFund,
          meta: {
            customerName: ctx.context.customerName,
            orderNumber: ctx.docNumber ?? undefined,
            driverName: ctx.driver,
            signedAt: new Date(),
            location,
          },
        },
        client,
      );
      setOpen(false);
      setDone(res.fileName);
      toast.success('הטופס נשמר');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto max-w-lg space-y-4">
        <div className="flex items-center gap-2 text-slate-900">
          <FileSignature className="h-6 w-6" />
          <h1 className="text-lg font-bold">חתימה על טופס</h1>
        </div>

        {loadError && (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{loadError}</span>
          </div>
        )}

        {needsLogin && (
          <div className="space-y-3 rounded-xl border bg-white p-4 text-sm">
            <p className="text-slate-700">כדי לחתום על טופס צריך להתחבר למערכת.</p>
            <Button className="h-12 w-full text-base" onClick={() => navigate('/login', { state: { from: location } })}>
              התחברות
            </Button>
          </div>
        )}

        {!ctx && !loadError && !needsLogin && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            טוען את פרטי העצירה
          </div>
        )}

        {ctx && (
          <div className="space-y-1 rounded-xl border bg-white p-4 text-sm">
            <div className="text-base font-semibold text-slate-900">{ctx.context.customerName}</div>
            <div className="text-slate-600">
              {kind ? FORM_KIND_LABEL[kind] : 'משימה'}
              {ctx.docNumber && <> · <bdi>{ctx.docNumber}</bdi></>}
            </div>
            <div className="text-slate-600">קופה בפריוריטי: {ctx.healthFund || 'לא רשומה'}</div>
          </div>
        )}

        {ctx && ctx.signed.length > 0 && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <div className="mb-1 font-semibold">כבר נחתם על העצירה הזו</div>
            {ctx.signed.map((s) => (
              <div key={s.id}>
                {getFormByKey(s.formKey)?.title ?? s.formKey} ·{' '}
                <bdi>{new Date(s.signedAt).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })}</bdi>
                {s.signedBy && <> · {s.signedBy}</>}
              </div>
            ))}
          </div>
        )}

        {ctx?.crane && (
          <div className="space-y-2 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm">
            <div className="font-semibold text-orange-950">
              {ctx.crane.kind === 'inspection' ? 'רשימת בדיקה לטכנאי, מנוף' : 'אישור קבלת הדרכה, מנוף'}
              {ctx.crane.model && <> · <bdi>{ctx.crane.model}</bdi></>}
            </div>
            <p className="text-orange-900">
              {ctx.crane.kind === 'inspection'
                ? 'חובה בכל ביקור אצל מנוף (עמי, 15/10). בלי הטופס אי אפשר לסמן את העצירה כבוצעה.'
                : 'חובה באספקת מנוף. בלי הטופס אי אפשר לסמן את העצירה כבוצעה.'}
            </p>
            {craneDone || ctx.craneSigned.some((c) => c.formType === ctx.crane?.kind) ? (
              <div className="flex items-center gap-1.5 font-semibold text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                טופס המנוף נחתם
              </div>
            ) : (
              <Button className="h-12 w-full bg-orange-600 text-base hover:bg-orange-700" onClick={() => setCraneOpen(true)}>
                פתח את טופס המנוף
              </Button>
            )}
          </div>
        )}

        {done ? (
          <div className="space-y-3 rounded-xl border border-emerald-300 bg-white p-5 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
            <div className="font-semibold text-slate-900">הטופס נשמר</div>
            <p className="text-sm text-slate-600">
              הוא נשמר במערכת ויצורף לכרטיס הלקוח בפריוריטי תוך כמה דקות.
            </p>
            {returnUrl || openedFromApp() ? (
              <Button className="h-12 w-full text-base" onClick={finish}>
                חזרה לאפליקציה
              </Button>
            ) : null}
          </div>
        ) : ctx && kind ? (
          <div className="space-y-3 rounded-xl border bg-white p-4">
            {sameKind.length > 1 && (
              <label className="block text-sm">
                <span className="mb-1 block text-slate-500">הטופס</span>
                <select
                  value={formKey ?? ''}
                  onChange={(e) => setFormKey(e.target.value || null)}
                  className="h-11 w-full rounded-lg border bg-white px-3 text-base"
                >
                  <option value="">בחר טופס</option>
                  {sameKind.map((d) => (
                    <option key={d.key} value={d.key}>
                      {d.fundLabel} · {d.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {!definition && (
              <p className="text-sm text-amber-800">{noFormReason(ctx.healthFund, kind)}. אפשר לבחור טופס ידנית.</p>
            )}
            <Button
              className="h-12 w-full text-base"
              disabled={!definition}
              onClick={() => setOpen(true)}
            >
              {ctx.signed.length ? 'חתימה על טופס נוסף' : 'פתח את הטופס'}
            </Button>
          </div>
        ) : ctx ? (
          <p className="text-sm text-slate-600">לעצירה מהסוג הזה אין טופס קופה.</p>
        ) : null}
      </div>

      {ctx?.crane?.kind === 'inspection' && (
        <CraneChecklistDialog
          open={craneOpen}
          onOpenChange={setCraneOpen}
          craneSerial={ctx.crane.serial}
          customerName={ctx.context.customerName}
          customerNumber={ctx.customerNumber}
          stopId={ctx.stopId}
          serviceCallId={ctx.serviceCallId}
          technicianName={ctx.driver}
          onSaved={() => setCraneDone(true)}
        />
      )}
      {ctx?.crane?.kind === 'training' && (
        <CraneTrainingDialog
          open={craneOpen}
          onOpenChange={setCraneOpen}
          craneSerial={ctx.crane.serial}
          customerName={ctx.context.customerName}
          customerNumber={ctx.customerNumber}
          stopId={ctx.stopId}
          orderId={ctx.orderId}
          technicianName={ctx.driver}
          onSaved={() => setCraneDone(true)}
        />
      )}

      {ctx && definition && open && (
        <SignFormDialog
          key={definition.key}
          open={open}
          onOpenChange={setOpen}
          definition={definition}
          context={ctx.context}
          lines={ctx.lines}
          driverName={ctx.driver}
          submitting={saving}
          onSubmit={submit}
        />
      )}
    </div>
  );
}
