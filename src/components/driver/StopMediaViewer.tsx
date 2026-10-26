import { useRef } from 'react';
import { ChevronLeft, ChevronRight, Image as ImageIcon, Mic, Play, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import type { CallMedia } from '@/lib/call-info';
import { ddmm, hhmm } from '@/lib/stop-info-text';

/** אריח של קובץ מהלקוח בכרטיס הקריאה. הופרד מ-`StopCallInfoSheet` ב-26/10/2026 (תקרת 400 שורות). */
export function MediaTile({ media, url, onClick }: { media: CallMedia; url?: string; onClick: () => void }) {
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
export function MediaViewer({
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
