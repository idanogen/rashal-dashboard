import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';

/**
 * מחסנית התבניות: מה שהצוות יכול לשלוח מהחלונית שבתוך הפריוריטי.
 *
 * ⭐ **המסך הזה הוא מראה של heyy, לא טופס הזנה.** הנוסח, המשתנים,
 * הקטגוריה והסטטוס מגיעים מ-`POST /v3/message_templates/search`, כי שם
 * הם נקבעו ושם מטא אישרה אותם. הקלדה ידנית של נוסח פירושה שני נוסחים
 * שיתפצלו, והלקוח יקבל את זה שאנחנו לא רואים.
 *
 * מה שכן נקבע כאן: **התווית** שהעובד רואה, **אם התבנית מוצעת לצוות**,
 * הסדר, וההערה.
 */

interface Template {
  key: string;
  heyy_template_id: string;
  name: string;
  label: string;
  category: 'utility' | 'marketing';
  body_preview: string;
  variables: string[] | null;
  attachment_kind: string | null;
  attachment_file_id: string | null;
  media_per_message: boolean;
  heyy_status: string | null;
  active: boolean;
  sort_order: number;
  notes: string | null;
  synced_at: string | null;
}

async function call(method: 'GET' | 'POST', body?: unknown) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch('/api/wa-templates', {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}

const ATTACHMENT_LABEL: Record<string, string> = {
  document: 'מסמך',
  video: 'סרטון',
  image: 'תמונה',
  audio: 'אודיו',
  button: 'כפתור',
};

const STATUS_LABEL: Record<string, string> = {
  active: 'מאושרת',
  in_review: 'בבדיקה',
  rejected: 'נדחתה',
  unavailable: 'לא זמינה',
  missing: 'נמחקה מ-heyy',
};

export function WhatsAppTemplatesPage() {
  const [rows, setRows] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [labelDraft, setLabelDraft] = useState('');
  const [notesDraft, setNotesDraft] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const json = await call('GET');
      setRows(json.templates as Template[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'הטעינה נכשלה');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function sync() {
    setSyncing(true);
    try {
      const r = await call('POST', { action: 'sync' });
      const parts: string[] = [];
      if (r.added?.length) parts.push(`${r.added.length} חדשות`);
      if (r.updated?.length) parts.push(`${r.updated.length} עודכנו`);
      if (r.missing?.length) parts.push(`${r.missing.length} כבר לא ב-heyy`);
      toast.success(parts.length ? parts.join(' · ') : 'אין שינוי');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'הסנכרון נכשל');
    } finally {
      setSyncing(false);
    }
  }

  async function toggle(t: Template) {
    try {
      await call('POST', { action: 'toggle', key: t.key, active: !t.active });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'העדכון נכשל');
    }
  }

  async function saveEdit(t: Template) {
    try {
      await call('POST', { action: 'update', key: t.key, label: labelDraft, notes: notesDraft });
      setEditing(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'השמירה נכשלה');
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6" dir="rtl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">תבניות וואטסאפ</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
            מה שהצוות יכול לשלוח מהחלונית שבתוך הפריוריטי. הנוסח והמשתנים מגיעים מ-heyy
            ולא נערכים כאן. מה שנקבע כאן: איך התבנית נקראת אצל העובד, ואם היא מוצעת לו.
          </p>
        </div>
        <Button onClick={() => void sync()} disabled={syncing}>
          {syncing ? 'מסנכרן…' : 'סנכרן מ-heyy'}
        </Button>
      </div>

      {loading && <div className="text-muted-foreground text-sm">טוען…</div>}
      {!loading && rows.length === 0 && (
        <div className="text-muted-foreground text-sm">
          אין עדיין תבניות. לחץ על "סנכרן מ-heyy".
        </div>
      )}

      <div className="space-y-3">
        {rows.map((t) => {
          const vars = t.variables ?? [];
          const isEditing = editing === t.key;
          return (
            <Card key={t.key} className={`p-4 ${t.active ? '' : 'opacity-70'}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {isEditing ? (
                      <Input
                        className="h-8 w-56"
                        value={labelDraft}
                        onChange={(e) => setLabelDraft(e.target.value)}
                        placeholder="איך זה נקרא אצל העובד"
                      />
                    ) : (
                      <span className="font-semibold">{t.label}</span>
                    )}
                    <span className="text-muted-foreground text-xs" dir="ltr">
                      {t.name}
                    </span>

                    {t.active ? (
                      <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">
                        מוצעת לצוות
                      </span>
                    ) : (
                      <span className="rounded bg-slate-200 px-2 py-0.5 text-xs text-slate-700">
                        לא מוצעת
                      </span>
                    )}

                    {/* 🔴 שיווק עולה יותר וכפוף להסכמת הנמען. גלוי תמיד. */}
                    {t.category === 'marketing' && (
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                        שיווק · עולה יותר
                      </span>
                    )}
                    {t.attachment_kind && (
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                        {ATTACHMENT_LABEL[t.attachment_kind] ?? t.attachment_kind}
                        {t.media_per_message && ' · משתנה פר לקוח'}
                      </span>
                    )}
                    {t.heyy_status && t.heyy_status !== 'active' && (
                      <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-800">
                        {STATUS_LABEL[t.heyy_status] ?? t.heyy_status}
                      </span>
                    )}
                  </div>

                  <pre className="mt-2 whitespace-pre-wrap rounded bg-[#dcf8c6] p-3 text-sm leading-relaxed">
                    {t.body_preview || '(אין גוף טקסט)'}
                  </pre>

                  <div className="text-muted-foreground mt-2 text-xs">
                    משתנים: {vars.length ? <span dir="ltr">{vars.join(' · ')}</span> : 'אין'}
                  </div>

                  {isEditing ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Input
                        className="h-8 flex-1"
                        value={notesDraft}
                        onChange={(e) => setNotesDraft(e.target.value)}
                        placeholder="הערה, למשל למה היא לא מוצעת"
                      />
                      <Button size="sm" onClick={() => void saveEdit(t)}>
                        שמור
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditing(null)}>
                        בטל
                      </Button>
                    </div>
                  ) : (
                    t.notes && <div className="text-muted-foreground mt-1 text-xs">{t.notes}</div>
                  )}
                </div>

                {!isEditing && (
                  <div className="flex shrink-0 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditing(t.key);
                        setLabelDraft(t.label);
                        setNotesDraft(t.notes ?? '');
                      }}
                    >
                      ערוך
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => void toggle(t)}>
                      {t.active ? 'הסר מהצוות' : 'הצע לצוות'}
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <p className="text-muted-foreground text-xs">
        🔴 הקטגוריה היא זו שמטא <strong>קבעה אחרי האישור</strong>, לא זו שהוגשה. תבנית
        שסווגה שיווק עולה יותר, כפופה להסכמת הנמען, ולא תגיע ללקוח שביקש לא לקבל דיוור.
      </p>
    </div>
  );
}
