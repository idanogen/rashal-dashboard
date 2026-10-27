import { FileSignature, ExternalLink, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useStopDocs } from '@/hooks/useStopDocs';
import { signedDocRows } from '@/lib/signed-docs';
import { openPrivateFile } from '@/lib/sb-open';
import { supabase } from '@/lib/supabase';
import { Section } from '@/components/driver/StopInfoSection';

/**
 * "✍️ טפסים חתומים" בחלונית העצירה בווב, כמו באפליקציה (עידן, 26/10/2026:
 * "פה אני בכלל לא רואה את הטופס החתום של הקופה"). שורה לכל מסמך, החדש ראשון,
 * לחיצה פותחת את ה-PDF. הדלי קריא לצוות המשרד בלבד, ולכן אצל נהג הסקשן ריק
 * ומוסתר (אותו כלל כמו באפליקציה).
 * ⭐ 27/10/2026: מתחת לכל טופס, אם הנהג שלח ללקוח העתק, לאן ומתי (`form_copy_sends`).
 */
interface CopySend {
  channel: 'whatsapp' | 'email';
  recipient: string;
  status: 'pending' | 'sent' | 'failed';
  detail: string | null;
  created_at: string;
  signed_forms: { pdf_path: string };
}

function useCopySends(stopId: string) {
  return useQuery({
    queryKey: ['formCopySends', stopId],
    enabled: !!stopId,
    staleTime: 60_000,
    queryFn: async (): Promise<CopySend[]> => {
      const { data, error } = await supabase
        .from('form_copy_sends')
        .select('channel, recipient, status, detail, created_at, signed_forms!inner(pdf_path, stop_id)')
        .eq('signed_forms.stop_id', stopId)
        .order('created_at', { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as CopySend[];
    },
  });
}

const hhmm = (iso: string) =>
  new Date(iso).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export function SignedFormsSection({ stopId }: { stopId: string }) {
  const { data, isLoading } = useStopDocs(stopId ? [stopId] : []);
  const { data: sends } = useCopySends(stopId);
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
          {rows.map((r) => {
            const copies = (sends ?? []).filter((c) => c.signed_forms?.pdf_path === r.pdfPath);
            return (
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
                {copies.map((c) => (
                  <div
                    key={`${c.channel}:${c.recipient}:${c.created_at}`}
                    title={c.status === 'failed' ? c.detail ?? undefined : undefined}
                    className={`px-2.5 pb-1.5 text-[11px] ${c.status === 'failed' ? 'text-red-700' : 'text-slate-600'}`}
                  >
                    {c.status === 'failed' ? '✗ ההעתק לא נשלח' : c.status === 'sent' ? '📤 נשלח העתק' : '⏳ נשלח העתק'}
                    {' '}{c.channel === 'whatsapp' ? 'בוואטסאפ' : 'במייל'} ל-<bdi>{c.recipient}</bdi> · <bdi>{hhmm(c.created_at)}</bdi>
                  </div>
                ))}
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}
