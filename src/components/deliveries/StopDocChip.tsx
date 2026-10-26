import { useState } from 'react';
import { HoverCard } from 'radix-ui';
import { ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { openStopDoc, useStopDocPreview, type StopDocState } from '@/hooks/useStopDocs';
import type { StopDocChip as Chip } from '@/lib/stop-docs';
import { signedDocRows } from '@/lib/signed-docs';

const CHIP_CLASS = {
  signed: 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100',
  note: 'border-indigo-300 bg-indigo-50 text-indigo-800 hover:bg-indigo-100',
  callDoc: 'border-indigo-300 bg-indigo-50 text-indigo-800 hover:bg-indigo-100',
  missingTraining: 'border-red-300 bg-red-50 text-red-800',
} as const;

/**
 * תג המסמך בכרטיס העצירה. מעבר עכבר פותח חלונית עם המסמך עצמו (עמוד
 * התעודה כתמונה, או ה-PDF החתום), לחיצה פותחת בלשונית. טופס קריאה פותח
 * את כרטיס הקריאה, שבו הטופס כבר מוצג.
 *
 * 🔴 26/10/2026 (עידן, ארבליי אביאור): "נחתם ×2" פתח רק את התעודה, וטופס
 * מכבי היה מוסתר מאחוריה. עם יותר ממסמך אחד החלונית מציגה רשימה, שורה
 * לכל מסמך, והלחיצה על התג פותחת את הרשימה במקום לנחש איזה קובץ רוצים.
 */
export function StopDocChip({
  chip,
  stopId,
  docs,
  onOpenCallInfo,
  defaultOpen = false,
}: {
  chip: Chip;
  stopId: string;
  docs?: StopDocState;
  onOpenCallInfo?: () => void;
  /** לתצוגה ב-preview.html בלבד. */
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [chosen, setChosen] = useState<string | undefined>(undefined);
  // "בלי הדרכה" הוא חיווי חוסר: אין לו קובץ לפתוח ואין תצוגה מקדימה.
  const previewable = (chip.kind === 'signed' || chip.kind === 'note') && !!docs;
  const rows = chip.kind === 'signed' && docs ? signedDocRows(docs.signed) : [];
  const many = rows.length > 1;
  const { data, isLoading, isError } = useStopDocPreview(stopId, docs, open && previewable, chosen);
  const openDoc = (pdfPath?: string) =>
    openStopDoc(stopId, docs!, pdfPath).catch((err) => toast.error(`פתיחת המסמך נכשלה: ${err.message}`));

  const button = (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (chip.kind === 'callDoc') {
          onOpenCallInfo?.();
          return;
        }
        if (!previewable || !docs) return;
        if (many) setOpen(true);
        else openDoc();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      title={previewable ? undefined : chip.title}
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-semibold ${CHIP_CLASS[chip.kind]}`}
    >
      {chip.label}
    </button>
  );
  if (!previewable) return button;

  const title = chip.kind === 'signed' ? (many ? 'הטפסים החתומים' : 'הטופס החתום') : 'תעודת המשלוח';
  return (
    <HoverCard.Root open={open} onOpenChange={setOpen} openDelay={250} closeDelay={150}>
      <HoverCard.Trigger asChild>{button}</HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          side="left"
          align="start"
          sideOffset={8}
          collisionPadding={12}
          className="z-[1100] w-[420px] max-w-[calc(100vw-24px)] rounded-lg border bg-white p-2 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div dir="rtl" className="mb-1.5 flex items-center justify-between gap-2 px-1 text-xs">
            <span className="font-semibold text-slate-800">
              {title}
              {/* רווח ולא ms: ב-bdi לטיני "התחלה" היא שמאל, והמספר נדבק לכותרת */}
              {!many && docs?.noteDocno && <> <bdi className="font-normal text-slate-500">{docs.noteDocno}</bdi></>}
            </span>
            {data && (
              <a href={data.pdfUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-indigo-700 hover:underline">
                <ExternalLink className="h-3 w-3" />
                פתח בלשונית
              </a>
            )}
          </div>
          {many && (
            <ul dir="rtl" className="mb-1.5 divide-y rounded border border-emerald-200 bg-emerald-50/40 text-xs">
              {rows.map((r) => {
                const active = (chosen ?? rows[0].pdfPath) === r.pdfPath;
                return (
                  <li key={r.pdfPath} className={`flex items-center gap-2 px-2 py-1.5 ${active ? 'bg-emerald-100/70' : ''}`}>
                    <button type="button" onClick={() => setChosen(r.pdfPath)} className="flex-1 text-start">
                      <span className={`font-semibold ${active ? 'text-emerald-900' : 'text-slate-800'}`}>{r.label}</span>
                      <bdi className="ms-2 text-slate-500">{r.when}</bdi>
                    </button>
                    <button
                      type="button"
                      onClick={() => openDoc(r.pdfPath)}
                      title="פתח בלשונית"
                      className="inline-flex items-center gap-1 text-indigo-700 hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="h-[540px] max-h-[70vh] overflow-auto rounded border bg-slate-50">
            {isLoading ? (
              <div className="flex h-full items-center justify-center text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : isError || !data ? (
              <div className="flex h-full items-center justify-center text-xs text-red-600">טעינת המסמך נכשלה</div>
            ) : data.pageUrls.length > 0 ? (
              data.pageUrls.map((u, i) => (
                <img key={u} src={u} alt={`עמוד ${i + 1}`} className="block w-full border-b bg-white last:border-b-0" />
              ))
            ) : (
              <iframe src={`${data.pdfUrl}#toolbar=0&view=FitH`} title="המסמך" className="h-full w-full bg-white" />
            )}
          </div>
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}
