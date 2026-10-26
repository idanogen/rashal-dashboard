import { FileSignature, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useStopDocs } from '@/hooks/useStopDocs';
import { signedDocRows } from '@/lib/signed-docs';
import { openPrivateFile } from '@/lib/sb-open';
import { Section } from '@/components/driver/StopInfoSection';

/**
 * "✍️ טפסים חתומים" בחלונית העצירה בווב, כמו באפליקציה (עידן, 26/10/2026:
 * "פה אני בכלל לא רואה את הטופס החתום של הקופה"). שורה לכל מסמך, החדש ראשון,
 * לחיצה פותחת את ה-PDF. הדלי קריא לצוות המשרד בלבד, ולכן אצל נהג הסקשן ריק
 * ומוסתר (אותו כלל כמו באפליקציה).
 */
export function SignedFormsSection({ stopId }: { stopId: string }) {
  const { data, isLoading } = useStopDocs(stopId ? [stopId] : []);
  const rows = signedDocRows(data?.[stopId]?.signed ?? []);
  if (!isLoading && rows.length === 0) return null;

  const openRow = (pdfPath: string) =>
    openPrivateFile('signed-forms', pdfPath).catch((e: Error) => toast.error(`פתיחת הטופס נכשלה: ${e.message}`));
  return (
    <Section icon={<FileSignature className="h-4 w-4 text-emerald-600" />} title="טפסים חתומים" meta={rows.length ? String(rows.length) : undefined}>
      {isLoading ? (
        <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          טוען…
        </div>
      ) : (
        <ul className="divide-y rounded-lg border border-emerald-200 bg-emerald-50/40">
          {rows.map((r) => (
            <li key={r.pdfPath}>
              <button
                type="button"
                onClick={() => openRow(r.pdfPath)}
                className="flex w-full items-center gap-2 px-2.5 py-2 text-start text-xs hover:bg-emerald-50"
              >
                <span className="font-semibold text-slate-800">{r.label}</span>
                <bdi className="text-slate-500">{r.when}</bdi>
                <ExternalLink className="ms-auto h-3.5 w-3.5 shrink-0 text-emerald-700" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
