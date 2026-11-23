import { useMemo, useState } from 'react';
import { Cpu, Loader2, Play } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import type { CallMedia } from '@/lib/call-info';
import {
  deviceSummary, groupByOwner, parseDeviceHistory, visitLabel, type DeviceCall, type DeviceMedia,
} from '@/lib/device-history';
import { pastMediaKey } from '@/lib/media-history';
import { pastMediaUrls } from '@/lib/past-media-fetch';
import { ddmm, friendlyError } from '@/lib/stop-info-text';
import { Empty, Section } from '@/components/driver/StopInfoSection';
import { MediaViewer } from '@/components/driver/StopMediaViewer';

interface Target {
  stopId?: string | null;
  serviceCallId?: string | null;
}

const fullDate = (iso: string) => {
  const d = ddmm(iso).replace(/\./g, '/');
  return d ? `${d}/${String(new Date(iso).getFullYear()).slice(2)}` : '';
};

/**
 * היסטוריית המכשיר (עידן, 23/11/2026): כל הקריאות על אותו מספר סידורי, אצל כל לקוח
 * שהמכשיר עבר דרכו, מהחדשה לישנה. משלים את "תמונות עבר של הלקוח" (ציר הלקוח).
 * ⭐ סגור עד לחיצה, כמו הגלריה: שום בקשה לא יוצאת כשפותחים כרטיס.
 */
export function DeviceHistorySection({ target }: { target: Target }) {
  const [open, setOpen] = useState(false);
  const [viewer, setViewer] = useState<number | null>(null);
  const q = useQuery({
    queryKey: ['deviceHistory', target.stopId ?? '', target.serviceCallId ?? ''],
    enabled: open,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('device_history', {
        p_stop_id: target.stopId || null,
        p_service_call_id: target.serviceCallId || null,
      });
      if (error) throw new Error(error.message);
      const h = parseDeviceHistory(data);
      return { ...h, urls: await pastMediaUrls(h.calls.flatMap((c) => c.media)) };
    },
  });

  const media = useMemo(() => (q.data?.calls ?? []).flatMap((c) => c.media), [q.data]);
  const viewerItems: CallMedia[] = media.map((m, i) => ({ messageId: pastMediaKey(m), index: i, at: m.at, type: m.type, path: pastMediaKey(m) }));
  const icon = <Cpu className="h-4 w-4 text-slate-600" />;

  if (!open) {
    return (
      <Section icon={icon} title="היסטוריית המכשיר">
        <Button variant="outline" size="sm" className="h-9 w-full" onClick={() => setOpen(true)}>
          כל הקריאות על המכשיר הזה, גם אצל לקוחות קודמים
        </Button>
      </Section>
    );
  }

  const h = q.data;
  return (
    <Section icon={icon} title="היסטוריית המכשיר" meta={h && h.total ? deviceSummary(h) : undefined}>
      {q.isLoading ? (
        <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          טוען…
        </div>
      ) : q.error ? (
        <Empty>{friendlyError(q.error.message)}</Empty>
      ) : !h || h.calls.length === 0 ? (
        <Empty>אין מספר סידורי לקריאה הזו, או שאין קריאות קודמות על המכשיר.</Empty>
      ) : (
        <div className="space-y-3">
          {groupByOwner(h.calls).map((g, gi) => (
            <div key={`${g.owner}-${gi}`} className="rounded-lg border bg-white">
              <div className="flex items-center gap-2 border-b bg-slate-50 px-2.5 py-1.5 text-[12px] font-bold text-slate-800">
                {g.customerName}
                <span className="font-normal text-slate-500">
                  <bdi>{fullDate(g.calls[g.calls.length - 1].created)}</bdi>
                  {g.calls.length > 1 && <> עד <bdi>{fullDate(g.calls[0].created)}</bdi></>}
                </span>
                {gi === 0 && <span className="ms-auto rounded bg-blue-50 px-1.5 text-[10.5px] text-blue-700">עכשיו</span>}
              </div>
              <div className="divide-y">
                {g.calls.map((c) => (
                  <CallRow key={c.id} call={c} thumbs={q.data!.urls.thumb} onOpen={(m) => setViewer(media.indexOf(m))} />
                ))}
              </div>
            </div>
          ))}
          {h.total > h.calls.length && (
            <div className="text-center text-[11px] text-muted-foreground">מוצגות {h.calls.length} הקריאות האחרונות מתוך {h.total}</div>
          )}
        </div>
      )}
      <MediaViewer items={viewerItems} urls={q.data?.urls.full ?? {}} index={viewer} onIndex={setViewer} />
    </Section>
  );
}

function CallRow({ call, thumbs, onOpen }: { call: DeviceCall; thumbs: Record<string, string>; onOpen: (m: DeviceMedia) => void }) {
  return (
    <div className={`space-y-1 px-2.5 py-2 text-[12.5px] ${call.current ? 'bg-amber-50/60' : ''}`}>
      <div className="flex flex-wrap items-center gap-x-2 text-[11.5px] text-slate-500">
        <bdi>{fullDate(call.created)}</bdi>
        {call.docno && <bdi className="font-medium text-slate-700">{call.docno}</bdi>}
        {call.current && <span className="rounded bg-amber-100 px-1 text-amber-800">הקריאה הזו</span>}
      </div>
      {call.fault && <div className="line-clamp-3 whitespace-pre-line text-slate-900">{call.fault}</div>}
      {call.visits.map((v, i) => (
        <div key={i} className="text-slate-700">
          <span className="text-slate-500">
            <bdi>{v.date ? fullDate(v.date) : ''}</bdi> {v.driver}
          </span>
          {visitLabel(v) && <span className="font-medium"> · {visitLabel(v)}</span>}
          {v.note && <span>: {v.note}</span>}
        </div>
      ))}
      {call.notes.map((n, i) => (
        <div key={`n${i}`} className="whitespace-pre-line text-slate-700">
          <span className="text-slate-500">{n.by ?? 'צוות'}:</span> {n.text}
        </div>
      ))}
      {call.media.length > 0 && (
        <div className="grid grid-cols-6 gap-1 pt-0.5">
          {call.media.map((m) => (
            <button
              key={pastMediaKey(m)}
              type="button"
              onClick={() => onOpen(m)}
              className="flex aspect-square items-center justify-center overflow-hidden rounded bg-slate-200"
            >
              {m.type === 'video' ? (
                <span className="flex h-full w-full items-center justify-center bg-slate-800 text-white"><Play className="h-4 w-4" /></span>
              ) : thumbs[pastMediaKey(m)] ? (
                <img src={thumbs[pastMediaKey(m)]} alt="תמונה מהקריאה" loading="lazy" className="h-full w-full object-cover" />
              ) : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
