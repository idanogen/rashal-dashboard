import { useState } from 'react';
import { ClipboardList, Contact, FileText, Image as ImageIcon, Loader2, MessageCircle, Navigation } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useServiceCallInfo, useStopCallInfo, type SignedCallInfo } from '@/hooks/useStopCallInfo';
import type { ServiceCall } from '@/types/service-call';
import { emptyMediaLine, infoDocno, infoKindLabel, splitPhones, type CallDocInfo, type CallMedia } from '@/lib/call-info';
import { buildWazeUrl } from '@/lib/navigation';
import { ddmm, friendlyError, hhmm } from '@/lib/stop-info-text';
import type { CalendarStop } from '@/types/calendar-stop';
import type { CalendarStop as CalendarViewStop } from '@/types/delivery';
import { CustomerPhoneBook } from '@/components/customer/CustomerPhoneBook';
import { SignedFormsSection } from '@/components/driver/SignedFormsSection';
import { Empty, Section } from '@/components/driver/StopInfoSection';
import { OrderBody, PickupBody } from '@/components/driver/StopInfoBodies';
import { MediaTile, MediaViewer } from '@/components/driver/StopMediaViewer';
// 26/10/2026: גופי האספקה והאיסוף, אבני הבניין והמציג הועברו לקבצים משלהם (תקרת 400 שורות).

interface StopCallInfoSheetProps {
  /** עצירה בסידור (עמוד הנהג). */
  stop?: CalendarStop;
  /** או קריאה שעוד לא שובצה (מסך הסדרן, 15/09/2026). */
  call?: ServiceCall;
  /** או כרטיס שירות ביומן של המשרד (עידן, 15/09/2026: "גם במסך של כולם"). */
  calendarStop?: CalendarViewStop;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenChat?: () => void;
}

/**
 * ⭐ כרטיס הקריאה לנהג ולטכנאי (עידן אישר את המוקאפ, 15/09/2026).
 * לחיצה על כרטיס עצירת שירות פותחת גיליון מלמטה: מה נשבר לפי פריוריטי,
 * מה הלקוח הראה וכתב בוואטסאפ, ומה המשרד כתב. רשימת העצירות נשארת מאחור.
 * מקבילה באפליקציה: `rashal-driver/src/components/StopInfoSheet.tsx`.
 */
export function StopCallInfoSheet({ stop, call: serviceCall, calendarStop, open, onOpenChange, onOpenChat }: StopCallInfoSheetProps) {
  // שני סוגי העצירה (עמוד הנהג / היומן) הולכים לאותה פונקציה במסד, לפי מזהה העצירה.
  const stopId = stop?.id ?? calendarStop?.stopId ?? '';
  const stopQuery = useStopCallInfo(stopId, open && !!stopId);
  const callQuery = useServiceCallInfo(serviceCall?.id ?? '', open && !stopId && !!serviceCall);
  const { data, isLoading, error } = stopId ? stopQuery : callQuery;
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [docViewerIndex, setDocViewerIndex] = useState<number | null>(null);

  // עמודי טופס הקריאה כפריטי תצוגה, לאותו מציג מסך-מלא של המדיה.
  const docPages: CallMedia[] = (data?.doc?.pagePaths ?? []).map((p, i) => ({
    messageId: `doc-${i}`,
    index: i,
    at: data?.doc?.receivedAt ?? '',
    type: 'image',
    path: p,
  }));

  const call = data?.call;
  // הסוג מהנתונים כשנטענו, ולפני כן מהעצירה עצמה, כדי שהכותרת לא תקפוץ.
  const kind = data?.kind ?? (serviceCall || (stop ?? calendarStop)?.sourceType === 'service' ? 'service'
    : (stop ?? calendarStop)?.sourceType === 'delivery' ? 'delivery'
    : (stop ?? calendarStop)?.sourceType === 'pickup' ? 'pickup' : 'none');
  const docno = data ? infoDocno(data) : undefined;
  const s = stop ?? calendarStop;
  const name = s?.customerName ?? serviceCall?.customerName ?? '';
  const city = s?.city ?? serviceCall?.city;
  const address = s?.address ?? serviceCall?.address;
  // ספר הטלפונים (עמי, 06-07/10/2026): מספר הלקוח מהעצירה או מהקריאה, הראשי מהרשומה.
  const customerNumber = stop?.customerNumber ?? calendarStop?.customerNumber ?? serviceCall?.customerNumber ?? null;
  const mainPhone = s?.phone ?? serviceCall?.phone ?? null;
  const window = s?.timeWindowStart && s?.timeWindowEnd ? `${s.timeWindowStart}-${s.timeWindowEnd}` : '';
  const wazeUrl = buildWazeUrl({
    address: address ? `${address}${city ? `, ${city}` : ''}` : null,
    coordinates: s?.coordinates ?? null,
  });

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          dir="rtl"
          aria-describedby={undefined}
          // בלי פוקוס אוטומטי: טבעת כחולה על התמונה הראשונה נראית כמו בחירה.
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="mx-auto flex max-h-[88dvh] w-full max-w-lg flex-col gap-0 rounded-t-2xl p-0"
        >
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-slate-300" />
          <SheetHeader className="space-y-1.5 border-b px-4 pb-3 pt-1 text-start">
            <SheetTitle className="pe-8 text-base leading-snug">{name}</SheetTitle>
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              <span className={`rounded px-1.5 font-semibold ${KIND_BADGE[kind]}`}>
                {infoKindLabel(kind)}{docno && <> <bdi>{docno}</bdi></>}
              </span>
              {(city || window) && (
                <span className="rounded bg-slate-100 px-1.5 text-slate-600">
                  {city}
                  {city && window && ' · '}
                  {window && <bdi dir="ltr">{window}</bdi>}
                </span>
              )}
              {call?.deviceDesc && <span className="rounded bg-slate-100 px-1.5 text-slate-600">{call.deviceDesc}</span>}
              {call?.deviceSerial && (
                <span className="rounded bg-slate-100 px-1.5 text-slate-600">
                  מס' סידורי <bdi>{call.deviceSerial}</bdi>
                </span>
              )}
            </div>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                טוען את הפרטים…
              </div>
            ) : error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {friendlyError((error as Error).message)}
              </div>
            ) : data ? (
              data.kind === 'delivery' && data.order ? (
                <OrderBody order={data.order} officeNote={data.officeNote} />
              ) : data.kind === 'pickup' && data.pickup ? (
                <PickupBody pickup={data.pickup} officeNote={data.officeNote} />
              ) : (
                <InfoBody info={data} onOpenMedia={setViewerIndex} onOpenDoc={setDocViewerIndex} />
              )
            ) : null}
            {/* 26/10/2026 (עידן): הטפסים החתומים גם בווב, כמו באפליקציה. */}
            {!isLoading && !error && stopId && <SignedFormsSection stopId={stopId} />}
            {!isLoading && !error && (
              <Section icon={<Contact className="h-4 w-4 text-blue-600" />} title="טלפונים" meta="גם להודעות האוטומטיות">
                <CustomerPhoneBook customerNumber={customerNumber} mainPhone={mainPhone} compact />
              </Section>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 border-t p-3">
            <Button variant="outline" className="h-11 gap-1.5" asChild>
              <a href={wazeUrl ?? '#'} target="_blank" rel="noopener noreferrer">
                <Navigation className="h-4 w-4" />
                ניווט
              </a>
            </Button>
            {onOpenChat && (
              <Button className="h-11 gap-1.5" onClick={onOpenChat}>
                <MessageCircle className="h-4 w-4" />
                פתח צ'אט
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {data && (
        <MediaViewer
          items={data.media}
          urls={data.urls}
          index={viewerIndex}
          onIndex={setViewerIndex}
        />
      )}
      {data && docPages.length > 0 && (
        <MediaViewer
          items={docPages}
          urls={data.urls}
          index={docViewerIndex}
          onIndex={setDocViewerIndex}
        />
      )}
    </>
  );
}

const KIND_BADGE: Record<string, string> = {
  service: 'bg-orange-100 text-orange-700',
  delivery: 'bg-blue-100 text-blue-700',
  pickup: 'bg-teal-100 text-teal-700',
  none: 'bg-slate-100 text-slate-600',
};

function InfoBody({ info, onOpenMedia, onOpenDoc }: { info: SignedCallInfo; onOpenMedia: (i: number) => void; onOpenDoc: (i: number) => void }) {
  const faultText = info.call?.faultText;
  const images = info.media.filter((m) => m.type === 'image').length;
  const videos = info.media.filter((m) => m.type === 'video').length;
  const firstAt = info.media[0]?.at ?? info.texts[0]?.at;
  const mediaMeta = [
    firstAt ? ddmm(firstAt) : '',
    images ? (images === 1 ? 'תמונה' : `${images} תמונות`) : '',
    videos ? (videos === 1 ? 'סרטון' : `${videos} סרטונים`) : '',
  ].filter(Boolean).join(' · ');

  return (
    <>
      <Section icon={<ClipboardList className="h-4 w-4 text-orange-600" />} title="תאור התקלה" meta="מפריוריטי">
        {faultText ? (
          <div className="whitespace-pre-line rounded-lg border border-orange-200 bg-orange-50 p-2.5 text-sm leading-relaxed text-orange-950">
            {splitPhones(faultText).map((p, i) =>
              p.tel ? (
                <a key={i} href={p.tel} dir="ltr" className="font-semibold text-blue-700 underline">
                  {p.text}
                </a>
              ) : (
                <span key={i}>{p.text}</span>
              ),
            )}
          </div>
        ) : (
          <Empty>לא נרשם תאור תקלה בפריוריטי</Empty>
        )}
      </Section>

      {info.doc && <CallDocSection doc={info.doc} urls={info.urls} onOpen={onOpenDoc} />}

      <Section icon={<ImageIcon className="h-4 w-4 text-emerald-600" />} title="מה הלקוח שלח בוואטסאפ" meta={mediaMeta || undefined}>
        {info.media.length > 0 ? (
          <div className="grid grid-cols-4 gap-1.5">
            {info.media.map((m, i) => (
              <MediaTile key={`${m.messageId}-${m.index}`} media={m} url={info.urls[m.path]} onClick={() => onOpenMedia(i)} />
            ))}
          </div>
        ) : (
          <Empty>{emptyMediaLine(info.mediaRequest, hhmm)}</Empty>
        )}
        {info.texts.length > 0 && (
          <div className="mt-2 flex flex-col items-start gap-1">
            {info.texts.map((t) => (
              <div key={t.messageId} className="max-w-[85%] rounded-xl rounded-es-sm bg-emerald-100 px-2.5 py-1 text-[13px] text-slate-900">
                {t.body}
                <span className="ms-2 text-[10px] text-slate-500"><bdi>{hhmm(t.at)}</bdi></span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {info.officeNote && (
        <Section icon={<MessageCircle className="h-4 w-4 text-primary" />} title="מהמשרד" meta="צ'אט הקריאה">
          <div className="rounded-lg border bg-slate-50 p-2.5 text-[13px]">
            <div className="mb-0.5 text-[11px] font-bold text-slate-700">
              {info.officeNote.userName} · <bdi>{ddmm(info.officeNote.at)} {hhmm(info.officeNote.at)}</bdi>
            </div>
            <div className="whitespace-pre-line">{info.officeNote.content}</div>
          </div>
        </Section>
      )}
    </>
  );
}

/**
 * טופס הקריאה המקורי מפריוריטי (מהמייל, 19/10/2026). עידן: "גם קריאות שירות
 * וגם משלוחים ללקוח אלה דברים שאנחנו רוצים להציג לנהגים ב-PDF".
 * תמונת עמוד שנפתחת למסך מלא; ה-PDF עצמו נשאר בדלי לצרכים הבאים.
 */
function CallDocSection({ doc, urls, onOpen }: { doc: CallDocInfo; urls: Record<string, string>; onOpen: (i: number) => void }) {
  const meta = [doc.status, doc.docDate ? ddmm(doc.docDate) : ''].filter(Boolean).join(' · ');
  return (
    <Section icon={<FileText className="h-4 w-4 text-indigo-600" />} title="טופס הקריאה מפריוריטי" meta={meta || undefined}>
      {doc.pagePaths.length ? (
        <div className="grid grid-cols-4 gap-1.5">
          {doc.pagePaths.map((p, i) => (
            <button
              key={p}
              type="button"
              onClick={() => onOpen(i)}
              className="relative flex aspect-[3/4] items-center justify-center overflow-hidden rounded-md border bg-white"
            >
              {urls[p] ? (
                <img src={urls[p]} alt={`טופס הקריאה, עמוד ${i + 1}`} loading="lazy" className="h-full w-full object-cover object-top" />
              ) : (
                <FileText className="h-5 w-5 text-slate-400" />
              )}
              {doc.pagePaths.length > 1 && (
                <span className="absolute bottom-0.5 end-0.5 rounded bg-slate-900/70 px-1 text-[10px] text-white">{i + 1}</span>
              )}
            </button>
          ))}
        </div>
      ) : (
        <Empty>הטופס נקלט בלי תמונת עמוד.</Empty>
      )}
    </Section>
  );
}

