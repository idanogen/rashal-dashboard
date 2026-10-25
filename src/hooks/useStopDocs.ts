import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface StopDocState {
  /** תעודת המשלוח המקורית (SH...), לעצירות אספקה ולקוח חדש. */
  noteDocno?: string;
  /** הטפסים שנחתמו על העצירה (קופה ומנוף), החדש אחרון. */
  signed: { pdfPath: string; formKey: string; signedAt: string }[];
  /** האם העצירה דורשת טופס מנוף, ואיזה (`stops_form_status`). */
  craneKind?: 'training' | 'inspection' | null;
  /** האם טופס המנוף מולא (גם בלי PDF, מילוי ישן). */
  craneSigned?: boolean;
}

/**
 * מסמכים מצורפים לעצירות שביומן, בשתי קריאות: תעודות המשלוח
 * (`stops_delivery_notes`, ההרשאה במסד) והטפסים החתומים (`signed_forms`,
 * קריא למשרד בלבד). עצירה שלא חזרה = אין מסמך.
 */
export function useStopDocs(stopIds: string[]) {
  const ids = [...new Set(stopIds)].sort();
  return useQuery({
    queryKey: ['stopDocs', ids.join(',')],
    enabled: ids.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<Record<string, StopDocState>> => {
      const out: Record<string, StopDocState> = {};
      const get = (id: string) => (out[id] ??= { signed: [] });
      // מנות של 200: כתובת ה-GET של signed_forms עם `in` ארוך נחתכת.
      for (let i = 0; i < ids.length; i += 200) {
        const chunk = ids.slice(i, i + 200);
        const [notes, forms, crane, status] = await Promise.all([
          supabase.rpc('stops_delivery_notes', { p_stop_ids: chunk }),
          supabase
            .from('signed_forms')
            .select('stop_id, form_key, pdf_path, signed_at')
            .in('stop_id', chunk)
            .not('pdf_path', 'is', null)
            .order('signed_at', { ascending: true }),
          // טפסי מנוף עם PDF (25/10/2026): מוצגים ביומן כמו טופס קופה חתום.
          supabase
            .from('crane_forms')
            .select('stop_id, form_type, pdf_path, submitted_at')
            .in('stop_id', chunk)
            .not('pdf_path', 'is', null),
          // מה העצירה דורשת: מזין את חיווי "בלי הדרכה" על אספקת מנוף שנסגרה.
          supabase.rpc('stops_form_status', { p_stop_ids: chunk }),
        ]);
        if (notes.error) throw new Error(notes.error.message);
        if (forms.error) throw new Error(forms.error.message);
        if (crane.error) throw new Error(crane.error.message);
        if (status.error) throw new Error(status.error.message);
        for (const r of (notes.data ?? []) as { stop_id: string; docno: string | null }[]) {
          if (r.stop_id && r.docno) get(r.stop_id).noteDocno = r.docno;
        }
        for (const r of (forms.data ?? []) as { stop_id: string; form_key: string; pdf_path: string; signed_at: string }[]) {
          get(r.stop_id).signed.push({ pdfPath: r.pdf_path, formKey: r.form_key, signedAt: r.signed_at });
        }
        for (const r of (crane.data ?? []) as { stop_id: string; form_type: string; pdf_path: string; submitted_at: string }[]) {
          get(r.stop_id).signed.push({ pdfPath: r.pdf_path, formKey: `crane-${r.form_type}`, signedAt: r.submitted_at });
        }
        for (const r of (status.data ?? []) as { stop_id: string; crane_kind: 'training' | 'inspection' | null; crane_signed: boolean }[]) {
          const s = get(r.stop_id);
          s.craneKind = r.crane_kind;
          s.craneSigned = r.crane_signed;
        }
      }
      // "האחרון" נשאר האחרון גם כשהטפסים מגיעים משתי טבלאות.
      for (const s of Object.values(out)) s.signed.sort((a, b) => a.signedAt.localeCompare(b.signedAt));
      return out;
    },
  });
}

export interface StopDocPreview {
  pdfUrl: string;
  /** עמודי התעודה המקורית כתמונות. לטופס חתום יש רק PDF. */
  pageUrls: string[];
  signed: boolean;
}

/** הקובץ שהתג מייצג: החתום האחרון, ואם אין, תעודת המקור. */
async function resolveStopDoc(stopId: string, state: StopDocState): Promise<StopDocPreview> {
  const last = state.signed.at(-1);
  if (last) {
    const { data, error } = await supabase.storage.from('signed-forms').createSignedUrl(last.pdfPath, 600);
    if (error || !data?.signedUrl) throw new Error(error?.message ?? 'לא ניתן לפתוח את הקובץ');
    return { pdfUrl: data.signedUrl, pageUrls: [], signed: true };
  }
  const { data, error } = await supabase.rpc('stop_delivery_note', { p_stop_id: stopId });
  if (error) throw new Error(error.message);
  const doc = data as { pdf_path?: string; page_paths?: string[] } | null;
  if (!doc?.pdf_path) throw new Error('הקובץ לא נמצא');
  const paths = [doc.pdf_path, ...(doc.page_paths ?? [])];
  const { data: signed, error: signErr } = await supabase.storage.from('delivery-note-docs').createSignedUrls(paths, 600);
  if (signErr) throw new Error(signErr.message);
  const url = (p: string) => signed?.find((s) => s.path === p)?.signedUrl ?? '';
  const pdfUrl = url(doc.pdf_path);
  if (!pdfUrl) throw new Error('לא ניתן לפתוח את הקובץ');
  return { pdfUrl, pageUrls: (doc.page_paths ?? []).map(url).filter(Boolean), signed: false };
}

/**
 * תצוגה מקדימה במעבר עכבר (עידן, 21/10/2026: "במעבר על התעודה היא יכולה
 * להיפתח לי בפופאפ?"). נטען רק כשהחלונית נפתחת; הכתובות חיות 10 דקות.
 */
export function useStopDocPreview(stopId: string, state: StopDocState | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['stopDocPreview', stopId, state?.noteDocno ?? '', state?.signed.at(-1)?.pdfPath ?? ''],
    enabled: enabled && !!state,
    staleTime: 5 * 60_000,
    queryFn: () => resolveStopDoc(stopId, state!),
  });
}

/**
 * פותח את המסמך בלשונית חדשה. החלון נפתח לפני הקריאה למסד, אחרת הדפדפן
 * חוסם אותו כחלון קופץ (הלחיצה כבר לא "של המשתמש" אחרי await).
 */
export async function openStopDoc(stopId: string, state: StopDocState): Promise<void> {
  const win = window.open('', '_blank');
  try {
    const { pdfUrl } = await resolveStopDoc(stopId, state);
    if (win) win.location.href = pdfUrl;
    else window.open(pdfUrl, '_blank');
  } catch (e) {
    win?.close();
    throw e;
  }
}
