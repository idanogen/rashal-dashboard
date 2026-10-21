import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface StopDocState {
  /** תעודת המשלוח המקורית (SH...), לעצירות אספקה ולקוח חדש. */
  noteDocno?: string;
  /** הטפסים שנחתמו על העצירה, החדש אחרון. */
  signed: { pdfPath: string; formKey: string; signedAt: string }[];
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
        const [notes, forms] = await Promise.all([
          supabase.rpc('stops_delivery_notes', { p_stop_ids: chunk }),
          supabase
            .from('signed_forms')
            .select('stop_id, form_key, pdf_path, signed_at')
            .in('stop_id', chunk)
            .not('pdf_path', 'is', null)
            .order('signed_at', { ascending: true }),
        ]);
        if (notes.error) throw new Error(notes.error.message);
        if (forms.error) throw new Error(forms.error.message);
        for (const r of (notes.data ?? []) as { stop_id: string; docno: string | null }[]) {
          if (r.stop_id && r.docno) get(r.stop_id).noteDocno = r.docno;
        }
        for (const r of (forms.data ?? []) as { stop_id: string; form_key: string; pdf_path: string; signed_at: string }[]) {
          get(r.stop_id).signed.push({ pdfPath: r.pdf_path, formKey: r.form_key, signedAt: r.signed_at });
        }
      }
      return out;
    },
  });
}

/**
 * פותח את המסמך בלשונית חדשה. החלון נפתח לפני הקריאה למסד, אחרת הדפדפן
 * חוסם אותו כחלון קופץ (הלחיצה כבר לא "של המשתמש" אחרי await).
 */
export async function openStopDoc(stopId: string, state: StopDocState): Promise<void> {
  const win = window.open('', '_blank');
  try {
    let bucket: string;
    let path: string | undefined;
    const last = state.signed.at(-1);
    if (last) {
      bucket = 'signed-forms';
      path = last.pdfPath;
    } else {
      bucket = 'delivery-note-docs';
      const { data, error } = await supabase.rpc('stop_delivery_note', { p_stop_id: stopId });
      if (error) throw new Error(error.message);
      path = (data as { pdf_path?: string } | null)?.pdf_path;
    }
    if (!path) throw new Error('הקובץ לא נמצא');
    const { data: signed, error: signErr } = await supabase.storage.from(bucket).createSignedUrl(path, 600);
    if (signErr || !signed?.signedUrl) throw new Error(signErr?.message ?? 'לא ניתן לפתוח את הקובץ');
    if (win) win.location.href = signed.signedUrl;
    else window.open(signed.signedUrl, '_blank');
  } catch (e) {
    win?.close();
    throw e;
  }
}
