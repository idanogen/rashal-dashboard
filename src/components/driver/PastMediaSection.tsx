import { useMemo, useState } from 'react';
import { History, Loader2, Play } from 'lucide-react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import type { CallMedia } from '@/lib/call-info';
import {
  groupPastMediaByDay, mergePages, nextCursor, pastMediaDayTitle, pastMediaKey, type PastMedia,
} from '@/lib/media-history';
import { fetchPastMedia, pastMediaTargetKey, pastMediaUrls, type PastMediaTarget } from '@/lib/past-media-fetch';
import { friendlyError } from '@/lib/stop-info-text';
import { Empty, Section } from '@/components/driver/StopInfoSection';
import { MediaViewer } from '@/components/driver/StopMediaViewer';

/**
 * תמונות עבר של הלקוח (עידן, 18/11/2026): כל מה שצולם אצלו מהאפליקציה ומה שהוא
 * שלח בוואטסאפ, לפי ביקור. מקבילה באפליקציה: `rashal-driver/src/components/PastMediaSheet.tsx`.
 * ⭐ סגור עד לחיצה: שום בקשה לא יוצאת כשפותחים כרטיס, ורק מוקטנות של כ-10KB בעמוד של 24.
 */
export function PastMediaSection({ target }: { target: PastMediaTarget }) {
  const [open, setOpen] = useState(false);
  const [viewer, setViewer] = useState<number | null>(null);
  const q = useInfiniteQuery({
    queryKey: ['pastMedia', ...pastMediaTargetKey(target)],
    enabled: open,
    staleTime: 5 * 60_000,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const page = await fetchPastMedia(target, pageParam);
      return { ...page, urls: await pastMediaUrls(page.items) };
    },
    getNextPageParam: (last, pages) => {
      const before = mergePages([], pages.slice(0, -1).flatMap((p) => p.items));
      const after = mergePages(before, last.items);
      // עמוד שלא הוסיף כלום (כולם באותה שנייה כמו הגבול) = סוף, אחרת לולאה.
      if (pages.length > 1 && after.length === before.length) return null;
      return nextCursor(after, last.total);
    },
  });

  const { items, thumb, full } = useMemo(() => {
    const pages = q.data?.pages ?? [];
    return {
      items: pages.reduce<PastMedia[]>((acc, p) => mergePages(acc, p.items), []),
      thumb: Object.assign({}, ...pages.map((p) => p.urls.thumb)) as Record<string, string>,
      full: Object.assign({}, ...pages.map((p) => p.urls.full)) as Record<string, string>,
    };
  }, [q.data]);
  const viewerItems: CallMedia[] = items.map((m, i) => ({ messageId: pastMediaKey(m), index: i, at: m.at, type: m.type, path: pastMediaKey(m) }));
  const total = q.data?.pages[0]?.total ?? 0;
  const icon = <History className="h-4 w-4 text-slate-600" />;

  if (!open) {
    return (
      <Section icon={icon} title="תמונות עבר של הלקוח">
        <Button variant="outline" size="sm" className="h-9 w-full" onClick={() => setOpen(true)}>
          הצג תמונות מביקורים קודמים ומהוואטסאפ
        </Button>
      </Section>
    );
  }

  return (
    <Section icon={icon} title="תמונות עבר של הלקוח" meta={q.isSuccess ? `${total}` : undefined}>
      {q.isLoading ? (
        <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          טוען…
        </div>
      ) : q.error ? (
        <Empty>{friendlyError(q.error.message)}</Empty>
      ) : items.length === 0 ? (
        <Empty>אין תמונות קודמות ללקוח הזה.</Empty>
      ) : (
        <div className="space-y-3">
          {groupPastMediaByDay(items).map((g) => (
            <div key={g.day}>
              <div className="mb-1 text-[11px] font-medium text-slate-500">{pastMediaDayTitle(g)}</div>
              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                {g.items.map((m) => (
                  <PastTile key={pastMediaKey(m)} media={m} url={thumb[pastMediaKey(m)]} onClick={() => setViewer(items.indexOf(m))} />
                ))}
              </div>
            </div>
          ))}
          {q.hasNextPage && (
            <Button variant="ghost" size="sm" className="w-full" onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage}>
              {q.isFetchingNextPage ? <Loader2 className="h-4 w-4 animate-spin" /> : `עוד (${total - items.length})`}
            </Button>
          )}
        </div>
      )}
      <MediaViewer items={viewerItems} urls={full} index={viewer} onIndex={setViewer} />
    </Section>
  );
}

function PastTile({ media, url, onClick }: { media: PastMedia; url?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex aspect-square items-center justify-center overflow-hidden rounded-md bg-slate-200 text-slate-500"
    >
      {media.type === 'video' ? (
        <span className="flex h-full w-full items-center justify-center bg-slate-800 text-white">
          <Play className="h-5 w-5" />
        </span>
      ) : url ? (
        <img src={url} alt="תמונה מביקור קודם" loading="lazy" className="h-full w-full object-cover" />
      ) : null}
      {media.src === 'customer' && (
        <span className="absolute bottom-0.5 start-0.5 rounded bg-black/55 px-1 text-[9px] text-white">וואטסאפ</span>
      )}
    </button>
  );
}
