import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import {
  Truck, Wrench, PackageOpen, FileText, MessageSquare, Star, Boxes,
  Clock, MapPin, Camera, MessageCircle, FileSignature, Search,
} from 'lucide-react';
import { Section, MatchTag } from '@/components/customer/CardParts';
import { useStopDocs, openStopDoc, type StopDocState } from '@/hooks/useStopDocs';
import { signedDocRows } from '@/lib/signed-docs';
import { openPrivateFile } from '@/lib/sb-open';
import { focusDocRef, eventMatchesFocus } from '@/lib/card-focus';
import type { TimelineEvent } from '@/lib/customer-card';

/**
 * ציר הפעילות של כרטיס הלקוח. פוצל מ-CustomerCard.tsx ב-24/11/2026.
 *
 * ⭐ 24/11/2026, עידן: "אני רוצה שכאשר מחפשים משהו ספציפי יהיה אפשר לראות אותו".
 * כשהכרטיס נפתח מחיפוש של מספר מסמך (SO/SH/SC), השורות של המסמך מודגשות
 * והראשונה נגללת לעין. לכל ביקור מוצגים הטפסים החתומים שלו, לחיצה פותחת PDF.
 * 🔴 הטפסים קריאים למשרד בלבד; במקום אחר השאילתה נכשלת והשורה פשוט בלי טפסים.
 */

const KIND_ICON: Record<TimelineEvent['kind'], typeof Truck> = {
  order: Truck,
  call: Wrench,
  pickup: PackageOpen,
  stop: MapPin,
  note: FileText,
  survey: Star,
  wa: MessageSquare,
  equipment: Boxes,
  returned: PackageOpen,
  photo: Camera,
  comment: MessageCircle,
};

const KIND_COLOR: Record<TimelineEvent['kind'], string> = {
  order: 'bg-blue-500',
  call: 'bg-orange-500',
  pickup: 'bg-teal-500',
  stop: 'bg-emerald-600',
  note: 'bg-slate-400',
  survey: 'bg-amber-500',
  wa: 'bg-violet-500',
  // ⭐ הציוד הוא מה שהלקוח מחזיק, ולכן הוא הנקודה הכהה על הציר.
  equipment: 'bg-slate-800',
  returned: 'bg-slate-300',
  photo: 'bg-pink-500',
  comment: 'bg-slate-500',
};

const CHIP = 'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold';

/** הטפסים החתומים של ביקור, ואם אין חתום אז תעודת המקור. */
function VisitDocs({ stopId, state }: { stopId: string; state: StopDocState | undefined }) {
  if (!state) return null;
  const rows = signedDocRows(state.signed);
  const fail = (e: Error) => toast.error(`פתיחת המסמך נכשלה: ${e.message}`);
  if (rows.length === 0 && !state.noteDocno) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1" data-testid="timeline-docs">
      {rows.map((r) => (
        <button
          key={r.pdfPath}
          type="button"
          onClick={() => openPrivateFile('signed-forms', r.pdfPath).catch(fail)}
          className={`${CHIP} border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100`}
        >
          <FileSignature className="h-3 w-3" />
          {r.label}
          <bdi className="font-normal text-emerald-700">{r.when}</bdi>
        </button>
      ))}
      {rows.length === 0 && state.noteDocno && (
        <button
          type="button"
          onClick={() => openStopDoc(stopId, state).catch(fail)}
          className={`${CHIP} border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}
        >
          <FileText className="h-3 w-3" />
          תעודה <bdi className="font-mono">{state.noteDocno}</bdi>
        </button>
      )}
    </div>
  );
}

export function CustomerTimeline({ events, focus }: { events: TimelineEvent[]; focus?: string | null }) {
  const focusRef = focusDocRef(focus);
  const stopIds = events.filter((e) => e.kind === 'stop' && e.stopId).map((e) => e.stopId as string);
  const docs = useStopDocs(stopIds);
  const docOf = (e: TimelineEvent) => (e.stopId ? docs.data?.[e.stopId] : undefined);
  const hit = events.map((e) => {
    const sh = docOf(e)?.noteDocno;
    return eventMatchesFocus(e, focusRef, sh ? [sh] : []);
  });
  const hits = hit.filter(Boolean).length;
  const firstHit = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (hits > 0) firstHit.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [hits]);
  const firstIndex = hit.indexOf(true);

  return (
    <Section title="ציר הפעילות" icon={Clock} count={events.length}>
      {focusRef && (
        <div
          className={`mb-2 flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11.5px] ${
            hits > 0 ? 'bg-amber-50 text-amber-900' : 'bg-slate-50 text-slate-600'
          }`}
        >
          <Search className="h-3 w-3 shrink-0" />
          {hits > 0 ? (
            <span>
              מודגש מה ששייך ל-<bdi className="font-mono font-semibold">{focusRef}</bdi>
            </span>
          ) : docs.isLoading ? (
            <span>מחפש את <bdi className="font-mono">{focusRef}</bdi> בציר…</span>
          ) : (
            <span>
              <bdi className="font-mono">{focusRef}</bdi> לא מופיע בציר
              (הציר מציג את 150 האירועים האחרונים של הלקוח)
            </span>
          )}
        </div>
      )}
      {events.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">אין עדיין פעילות רשומה.</div>
      ) : (
        <div className="max-h-[420px] space-y-0 overflow-y-auto border-s-2 border-slate-100 ps-3">
          {events.map((e, i) => {
            const Icon = KIND_ICON[e.kind] ?? FileText;
            return (
              <div
                key={`${e.at}-${i}`}
                ref={i === firstIndex ? firstHit : undefined}
                data-focus={hit[i] ? 'hit' : undefined}
                className={`relative py-1.5 ${hit[i] ? 'rounded-lg bg-amber-50 pe-1.5 ring-1 ring-inset ring-amber-300' : ''}`}
              >
                <span className={`absolute -start-[19px] top-3 h-2 w-2 rounded-full ring-2 ring-white ${KIND_COLOR[e.kind] ?? 'bg-slate-300'}`} />
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="font-mono text-[10.5px] text-muted-foreground">
                    {new Date(e.at).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                  </span>
                  <Icon className="h-3 w-3 text-slate-400" />
                  <span className="text-[12.5px] font-semibold text-slate-800">{e.title}</span>
                  {e.ref && <bdi className="font-mono text-[11px] text-blue-700">{e.ref}</bdi>}
                  {e.kind === 'stop' && (e.refs ?? []).map((r) => (
                    <bdi key={r} className="font-mono text-[11px] text-slate-500">{r}</bdi>
                  ))}
                  {(e.kind === 'photo' || e.kind === 'comment') && e.by && (
                    <span className="text-[11px] text-slate-500">{e.by}</span>
                  )}
                  <MatchTag kind={e.match} />
                </div>
                {e.detail && <div className="text-[11.5px] leading-snug text-muted-foreground">{e.detail}</div>}
                {/* ⭐ 07/09/2026: מה הנהג כתב וצילם באותו ביקור, בתוך שורת הביקור.
                    עידן: "למה אני לא רואה את התמונות שהוא שלח ואת ההערות של הנהג". */}
                {(e.messages ?? []).length > 0 && (
                  <div className="mt-0.5 space-y-0.5">
                    {e.messages!.map((m, j) => (
                      <div key={j} className="text-[11.5px] leading-snug text-slate-700">
                        {m.by && <span className="font-semibold text-slate-600">{m.by}: </span>}
                        {m.text}
                      </div>
                    ))}
                  </div>
                )}
                {e.kind === 'stop' && e.stopId && <VisitDocs stopId={e.stopId} state={docOf(e)} />}
                {(e.photos ?? []).length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1" data-testid="timeline-photos">
                    {e.photos!.map((url, j) => (
                      <img
                        key={j}
                        src={url}
                        alt="תמונה מהשטח"
                        loading="lazy"
                        className="h-14 w-14 cursor-pointer rounded-md border border-slate-200 object-cover hover:opacity-90"
                        onClick={() => window.open(url, '_blank', 'noopener')}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}
