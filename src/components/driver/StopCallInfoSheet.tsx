import { useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  Mic,
  Navigation,
  Play,
  X,
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useServiceCallInfo, useStopCallInfo, type SignedCallInfo } from '@/hooks/useStopCallInfo';
import type { ServiceCall } from '@/types/service-call';
import { emptyMediaLine, splitPhones, type CallMedia } from '@/lib/call-info';
import { buildWazeUrl } from '@/lib/navigation';
import type { CalendarStop } from '@/types/calendar-stop';
import type { CalendarStop as CalendarViewStop } from '@/types/delivery';

const TZ = 'Asia/Jerusalem';
const hhmm = (iso: string) =>
  iso ? new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: TZ }) : '';
const ddmm = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', timeZone: TZ }) : '';

function friendlyError(message: string): string {
  return /not authorized/i.test(message)
    ? 'הפרטים של הקריאה הזאת פתוחים רק לטכנאי שהיא משובצת אצלו.'
    : 'לא הצלחנו לטעון את פרטי הקריאה. נסו שוב בעוד רגע.';
}

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

  const call = data?.call;
  const s = stop ?? calendarStop;
  const name = s?.customerName ?? serviceCall?.customerName ?? '';
  const city = s?.city ?? serviceCall?.city;
  const address = s?.address ?? serviceCall?.address;
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
              <span className="rounded bg-orange-100 px-1.5 font-semibold text-orange-700">
                קריאת שירות{call?.docno && <> <bdi>{call.docno}</bdi></>}
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
                טוען את פרטי הקריאה…
              </div>
            ) : error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {friendlyError((error as Error).message)}
              </div>
            ) : data ? (
              <InfoBody info={data} onOpenMedia={setViewerIndex} />
            ) : null}
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
    </>
  );
}

function Section({ icon, title, meta, children }: { icon: React.ReactNode; title: string; meta?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-bold text-slate-900">
        {icon}
        {title}
        {meta && (
          <span className="ms-auto rounded-full bg-slate-100 px-2 text-[10.5px] font-medium text-slate-500">{meta}</span>
        )}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/60 p-2.5 text-xs text-muted-foreground">{children}</div>;
}

function InfoBody({ info, onOpenMedia }: { info: SignedCallInfo; onOpenMedia: (i: number) => void }) {
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

function MediaTile({ media, url, onClick }: { media: CallMedia; url?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex aspect-square items-center justify-center overflow-hidden rounded-md bg-slate-200 text-slate-500"
    >
      {media.type === 'image' && url ? (
        <img src={url} alt="תמונה מהלקוח" loading="lazy" className="h-full w-full object-cover" />
      ) : media.type === 'video' ? (
        <span className="flex h-full w-full items-center justify-center bg-slate-800 text-white">
          <Play className="h-5 w-5" />
        </span>
      ) : media.type === 'audio' ? (
        <Mic className="h-5 w-5" />
      ) : (
        <ImageIcon className="h-5 w-5" />
      )}
    </button>
  );
}

/** צפייה במסך מלא עם דפדוף (כפתורים או החלקה). */
function MediaViewer({
  items,
  urls,
  index,
  onIndex,
}: {
  items: CallMedia[];
  urls: Record<string, string>;
  index: number | null;
  onIndex: (i: number | null) => void;
}) {
  const touchX = useRef<number | null>(null);
  const open = index != null && index >= 0 && index < items.length;
  const media = open ? items[index] : null;
  const url = media ? urls[media.path] : undefined;
  const go = (delta: number) => {
    if (index == null || !items.length) return;
    onIndex((index + delta + items.length) % items.length);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onIndex(null)}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        dir="rtl"
        className="flex h-[100dvh] w-screen max-w-none flex-col gap-0 rounded-none border-0 bg-black p-0 text-white sm:max-w-none"
        onTouchStart={(e) => { touchX.current = e.touches[0]?.clientX ?? null; }}
        onTouchEnd={(e) => {
          const start = touchX.current;
          const end = e.changedTouches[0]?.clientX;
          touchX.current = null;
          if (start == null || end == null || Math.abs(end - start) < 50) return;
          // RTL: הפריט הבא נמצא משמאל, ולכן החלקה ימינה מביאה אותו.
          go(end > start ? 1 : -1);
        }}
      >
        <DialogTitle className="sr-only">קובץ מהלקוח</DialogTitle>
        <div className="flex items-center justify-between px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <span className="text-sm text-white/80">
            <bdi dir="ltr">{(index ?? 0) + 1} / {items.length}</bdi>
            {media?.at && <> · <bdi>{ddmm(media.at)} {hhmm(media.at)}</bdi></>}
          </span>
          <button type="button" onClick={() => onIndex(null)} className="rounded-full bg-white/10 p-2" aria-label="סגירה">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center px-2">
          {!url ? (
            <span className="text-sm text-white/70">הקובץ לא זמין כרגע</span>
          ) : media?.type === 'image' ? (
            <img src={url} alt="תמונה מהלקוח" className="max-h-full max-w-full object-contain" />
          ) : media?.type === 'video' ? (
            <video key={url} src={url} controls autoPlay playsInline className="max-h-full max-w-full" />
          ) : (
            <audio key={url} src={url} controls autoPlay className="w-full max-w-sm" />
          )}
        </div>
        {items.length > 1 && (
          <div className="grid grid-cols-2 gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
            <button type="button" onClick={() => go(-1)} className="flex h-11 items-center justify-center gap-1 rounded-lg bg-white/10 text-sm">
              <ChevronRight className="h-4 w-4" />
              הקודם
            </button>
            <button type="button" onClick={() => go(1)} className="flex h-11 items-center justify-center gap-1 rounded-lg bg-white/10 text-sm">
              הבא
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
