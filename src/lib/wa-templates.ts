import { supabase } from './supabase';

/**
 * התבניות שאפשר לשלוח מהדשבורד.
 *
 * 🔴 **`mediaPerMessage` הוא הקו המפריד.** תבנית שנושאת קובץ **משלה**
 * (כמו תזכורת הבטיחות עם הסרטון) נשלחת מכל מקום, כי הקובץ כבר יושב
 * אצל heyy. תבנית שדורשת מסמך **לכל הודעה** (שליחת תעודה או חשבונית)
 * מחייבת את הסשן של פריוריטי כדי להפיק אותו, ולכן היא נשלחת מהחלונית
 * בלבד ואינה מוצעת כאן.
 */
export interface SendableTemplate {
  key: string;
  label: string;
  bodyPreview: string;
  variables: string[];
  attachmentKind: string | null;
  category: string;
}

interface Row {
  key: string;
  label: string | null;
  name: string;
  body_preview: string | null;
  variables: string[] | null;
  attachment_kind: string | null;
  category: string | null;
  media_per_message: boolean | null;
  active: boolean;
  heyy_status: string | null;
}

export async function fetchSendableTemplates(): Promise<SendableTemplate[]> {
  const { data, error } = await supabase
    .from('wa_templates')
    .select('key, label, name, body_preview, variables, attachment_kind, category, media_per_message, active, heyy_status')
    .eq('active', true)
    .order('sort_order', { ascending: true });
  if (error) throw error;

  return (data as Row[])
    // מטא חייבת לאשר, ותבנית שדורשת מסמך פר-הודעה אינה שייכת לכאן.
    .filter((r) => r.heyy_status === 'active' && !r.media_per_message)
    .map((r) => ({
      key: r.key,
      label: r.label || r.name,
      bodyPreview: r.body_preview ?? '',
      variables: r.variables ?? [],
      attachmentKind: r.attachment_kind,
      category: r.category ?? '',
    }));
}
