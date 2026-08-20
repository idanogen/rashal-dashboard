import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';

/**
 * מחסנית התבניות: מה שהצוות יכול לשלוח מהחלונית שבתוך הפריוריטי.
 *
 * ⭐ הסיבה שהמסך הזה קיים: המחסנית הייתה כתובה בקוד, ולכן תבנית חדשה
 * דרשה פריסה. **ל-heyy אין API לתבניות**, אז ממילא אי אפשר למשוך את
 * הרשימה משם. כאן מוסיפים שורה, וכל הצוות מקבל אותה מיד.
 *
 * 🔴 **המשתנים לא מוזנים בנפרד.** הם נגזרים מהנוסח, כאן ובשרת, ולכן אי
 * אפשר שיתפצלו ממנו. משתנה שנכתב בשם אחר מזה שבעורך של heyy מגיע ללקוח
 * כערך ריק, בלי שום שגיאה בדרך.
 */

interface Template {
  key: string;
  heyy_template_id: string;
  name: string;
  label: string;
  category: 'utility' | 'marketing';
  body_preview: string;
  has_document_header: boolean;
  active: boolean;
  sort_order: number;
  notes: string | null;
  variables: string[];
}

const EMPTY: Template = {
  key: '',
  heyy_template_id: '',
  name: '',
  label: '',
  category: 'utility',
  body_preview: '',
  has_document_header: false,
  active: true,
  sort_order: 100,
  notes: null,
  variables: [],
};

/** אותה נוסחה שבשרת. שם המשתנה בין שני זוגות סוגריים מסולסלים. */
function variablesOf(body: string): string[] {
  const seen: string[] = [];
  for (const m of String(body ?? '').matchAll(/\{\{(\w+)\}\}/g)) {
    if (!seen.includes(m[1])) seen.push(m[1]);
  }
  return seen;
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

export function WhatsAppTemplatesPage() {
  const [rows, setRows] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Template>(EMPTY);
  const [saving, setSaving] = useState(false);

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

  const draftVars = useMemo(() => variablesOf(draft.body_preview), [draft.body_preview]);

  async function save() {
    setSaving(true);
    try {
      await call('POST', { action: 'save', ...draft });
      toast.success(`התבנית "${draft.label}" נשמרה`);
      setDraft(EMPTY);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'השמירה נכשלה');
    } finally {
      setSaving(false);
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

  return (
    <div className="space-y-6 p-4 md:p-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-semibold">תבניות וואטסאפ</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          מה שהצוות יכול לשלוח מהחלונית שבתוך הפריוריטי. תבנית חדשה נכנסת לשימוש מיד,
          בלי עדכון גרסה של התוסף.
        </p>
      </div>

      {/* ── הרשימה ─────────────────────────────────────── */}
      <div className="space-y-3">
        {loading && <div className="text-muted-foreground text-sm">טוען…</div>}
        {!loading && rows.length === 0 && (
          <div className="text-muted-foreground text-sm">אין עדיין תבניות.</div>
        )}
        {rows.map((t) => (
          <Card key={t.key} className={`p-4 ${t.active ? '' : 'opacity-60'}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{t.label}</span>
                  <span className="text-muted-foreground text-xs" dir="ltr">
                    {t.name}
                  </span>
                  {t.category === 'marketing' && (
                    // 🔴 שיווק עולה יותר וכפוף להסכמת הנמען. זה חייב להיות גלוי.
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                      שיווק · עולה יותר
                    </span>
                  )}
                  {t.has_document_header && (
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                      נושאת קובץ
                    </span>
                  )}
                  {!t.active && (
                    <span className="rounded bg-slate-200 px-2 py-0.5 text-xs text-slate-700">כבויה</span>
                  )}
                </div>
                <pre className="mt-2 whitespace-pre-wrap rounded bg-[#dcf8c6] p-3 text-sm leading-relaxed">
                  {t.body_preview}
                </pre>
                <div className="text-muted-foreground mt-2 text-xs">
                  משתנים: {t.variables.length ? t.variables.join(' · ') : 'אין'}
                </div>
                {t.notes && <div className="text-muted-foreground mt-1 text-xs">{t.notes}</div>}
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="outline" size="sm" onClick={() => setDraft(t)}>
                  ערוך
                </Button>
                <Button variant="outline" size="sm" onClick={() => void toggle(t)}>
                  {t.active ? 'כבה' : 'הפעל'}
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* ── הוספה ועריכה ───────────────────────────────── */}
      <Card className="space-y-4 p-4">
        <h2 className="font-semibold">{rows.some((r) => r.key === draft.key) ? 'עריכת תבנית' : 'תבנית חדשה'}</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="label">מה העובד רואה</Label>
            <Input
              id="label"
              value={draft.label}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              placeholder="תיאום משלוח"
            />
          </div>
          <div>
            <Label htmlFor="key">מפתח פנימי</Label>
            <Input
              id="key"
              dir="ltr"
              value={draft.key}
              onChange={(e) => setDraft({ ...draft, key: e.target.value })}
              placeholder="delivery_coordination"
            />
          </div>
          <div>
            <Label htmlFor="name">שם התבנית ב-heyy</Label>
            <Input
              id="name"
              dir="ltr"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="ogen_delivery_coordination"
            />
          </div>
          <div>
            <Label htmlFor="hid">מזהה התבנית ב-heyy</Label>
            <Input
              id="hid"
              dir="ltr"
              value={draft.heyy_template_id}
              onChange={(e) => setDraft({ ...draft, heyy_template_id: e.target.value })}
              placeholder="00000000-0000-0000-0000-000000000000"
            />
            <p className="text-muted-foreground mt-1 text-xs">
              נשלף מכתובת הדפדפן של דף התבנית ב-heyy. אין להם ממשק אחר להוצאת המזהה.
            </p>
          </div>
        </div>

        <div>
          <Label htmlFor="body">הנוסח, בדיוק כפי שאושר במטא</Label>
          <textarea
            id="body"
            className="border-input mt-1 min-h-28 w-full rounded-md border bg-transparent p-3 text-sm"
            value={draft.body_preview}
            onChange={(e) => setDraft({ ...draft, body_preview: e.target.value })}
            placeholder={'שלום {{customer_name}}, תיאמנו משלוח ליום {{date}}.'}
          />
          <p className="text-muted-foreground mt-1 text-xs">
            כל משתנה נכתב כך: <span dir="ltr">{'{{שם_המשתנה}}'}</span>, ובאותו שם בדיוק
            כמו בעורך של heyy. שם שונה מגיע ללקוח כערך ריק, בלי שום שגיאה.
          </p>
          <div className="mt-2 text-xs">
            <span className="text-muted-foreground">משתנים שזוהו: </span>
            {draftVars.length ? (
              <span dir="ltr">{draftVars.join(' · ')}</span>
            ) : (
              <span className="text-amber-700">אין. תבנית בלי משתנה לא תדע למי היא פונה.</span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.category === 'marketing'}
              onChange={(e) => setDraft({ ...draft, category: e.target.checked ? 'marketing' : 'utility' })}
            />
            מטא סיווגה כשיווק
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.has_document_header}
              onChange={(e) => setDraft({ ...draft, has_document_header: e.target.checked })}
            />
            נושאת קובץ בכותרת
          </label>
          <div className="flex items-center gap-2 text-sm">
            <Label htmlFor="sort" className="whitespace-nowrap">
              סדר
            </Label>
            <Input
              id="sort"
              className="w-20"
              type="number"
              value={draft.sort_order}
              onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })}
            />
          </div>
        </div>

        <p className="text-muted-foreground text-xs">
          🔴 הקטגוריה היא זו שמטא <strong>קבעה אחרי האישור</strong>, לא זו שהוגשה. תבנית
          שסווגה שיווק עולה יותר, כפופה להסכמת הנמען, ולא תגיע ללקוח שביקש לא לקבל דיוור.
        </p>

        <div className="flex gap-2">
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? 'שומר…' : 'שמור'}
          </Button>
          {draft.key && (
            <Button variant="outline" onClick={() => setDraft(EMPTY)}>
              נקה
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
