import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MessageSquare, Camera, Star, CalendarClock, Hand, ShieldOff, AlertTriangle, Loader2, Truck,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useIsAdmin } from '@/hooks/useProfile';
import { engineState, ENGINE_STATE_CLASS, sinceLabel } from '@/lib/wa-automation-view';

/**
 * חדר הבקרה של אוטומציות הוואטסאפ · `/admin/wa-automations`
 *
 * עידן, 30/08/2026: "אני רוצה שיהיה לנו מקום אחד שהכל מרוכז. זה מתחיל
 * להיות הרבה תהליכים וקשה לי לנהל."
 *
 * מסך אחד, כרטיס לכל תהליך: מה מצבו, כמה יצא, כמה ממתין, ומתי המנוע
 * רץ לאחרונה. 🔴 ההרשאה נאכפת במסד (`wa_automation_overview` דורשת
 * הנהלה, `wa_automation_toggle` מנהל מערכת), לא במסך.
 */

interface EngineNumbers {
  enabled: boolean;
  dry_run: boolean;
  last_run_at: string | null;
  [k: string]: unknown;
}

interface Overview {
  surveys: EngineNumbers & {
    sent_today: number; sent_7d: number; answered_7d: number; queue: number; failed_open: number;
  };
  media: EngineNumbers & {
    sent_today: number; waiting: number; queue: number; received_7d: number;
    no_response_open: number; no_phone_open: number; failed_open: number;
  };
  on_way: EngineNumbers & { sent_today: number; sent_7d: number; skipped_today: number };
  reminders: { sent_7d: number; last_at: string | null };
  manual: { sent_7d: number; last_at: string | null };
  suppressed: number;
  delivery_failed_7d: number;
  generated_at: string;
}

async function fetchOverview(): Promise<Overview> {
  const { data, error } = await supabase.rpc('wa_automation_overview');
  if (error) throw new Error(error.message);
  return data as Overview;
}

export function WaAutomationsPage() {
  const isAdmin = useIsAdmin();
  const qc = useQueryClient();
  const { data, isLoading, error, dataUpdatedAt } = useQuery({
    queryKey: ['wa-automation-overview'],
    queryFn: fetchOverview,
    refetchInterval: 60 * 1000,
  });

  const toggle = useMutation({
    mutationFn: async (input: { engine: string; enabled: boolean }) => {
      const { error: e } = await supabase.rpc('wa_automation_toggle', {
        p_engine: input.engine,
        p_enabled: input.enabled,
      });
      if (e) throw new Error(e.message);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['wa-automation-overview'] }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> טוען את תמונת המצב...
      </div>
    );
  }
  // 🔴 מצב ריק שמדבר: כישלון טעינה אינו "אין אוטומציות". ורק כשאין
  // נתונים בכלל: רענון-רקע שנכשל לא מרוקן מסך שכבר מציג אמת.
  if (!data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-800">
        תמונת המצב לא נטענה: {error instanceof Error ? error.message : 'שגיאה'}
      </div>
    );
  }

  const now = new Date();
  const surveysState = engineState(data.surveys.enabled, data.surveys.dry_run);
  const mediaState = engineState(data.media.enabled, data.media.dry_run);
  const onWayState = engineState(data.on_way.enabled, data.on_way.dry_run);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">אוטומציות וואטסאפ</h1>
          <p className="text-sm text-muted-foreground">
            כל תהליכי ההודעות במקום אחד: מצב, נפח, ומה שממתין לטיפול
          </p>
        </div>
        <p className="text-[11px] text-muted-foreground">
          עודכן {sinceLabel(new Date(dataUpdatedAt).toISOString(), now)}
        </p>
      </div>

      {/* חריגים רוחביים, לפני הכרטיסים: מה שדורש עין אנושית */}
      {(data.delivery_failed_7d > 0 || data.suppressed > 0) && (
        <div className="flex flex-wrap gap-2">
          {data.delivery_failed_7d > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-[12px] font-medium text-red-800">
              <AlertTriangle className="h-3.5 w-3.5" />
              {data.delivery_failed_7d} הודעות לא נמסרו בשבוע האחרון
            </span>
          )}
          {data.suppressed > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[12px] font-medium text-slate-700">
              <ShieldOff className="h-3.5 w-3.5" />
              {data.suppressed} מספרים ברשימת המושתקים
            </span>
          )}
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {/* ── תמונה לפני טכנאי ── */}
        <EngineCard
          icon={Camera}
          title="תמונה לפני טכנאי"
          description="קריאה שמגיעה ללביצוע מבקשת מהלקוח תמונה של התקלה. תזכורת אחת אחרי 4 שעות."
          state={mediaState}
          lastRun={sinceLabel(data.media.last_run_at, now)}
          numbers={[
            { label: 'יצאו היום', value: data.media.sent_today },
            { label: 'ממתינים לתמונה', value: data.media.waiting },
            { label: 'בתור', value: data.media.queue },
            { label: 'תמונות התקבלו (7 ימים)', value: data.media.received_7d },
          ]}
          attention={[
            data.media.no_response_open > 0 && `${data.media.no_response_open} בלי מענה, למוקד`,
            data.media.no_phone_open > 0 && `${data.media.no_phone_open} בלי נייד`,
            data.media.failed_open > 0 && `${data.media.failed_open} שליחות נכשלו`,
          ]}
          toggle={isAdmin ? {
            enabled: data.media.enabled,
            busy: toggle.isPending,
            onToggle: () => toggle.mutate({ engine: 'media', enabled: !data.media.enabled }),
          } : undefined}
        />

        {/* ── סקרי שביעות רצון ── */}
        <EngineCard
          icon={Star}
          title="סקר שביעות רצון"
          description="שעה אחרי שעצירה נסגרת כסופקה, הלקוח מקבל קישור אישי לסקר."
          state={surveysState}
          lastRun={sinceLabel(data.surveys.last_run_at, now)}
          numbers={[
            { label: 'יצאו היום', value: data.surveys.sent_today },
            { label: 'יצאו (7 ימים)', value: data.surveys.sent_7d },
            { label: 'נענו (7 ימים)', value: data.surveys.answered_7d },
            { label: 'בתור', value: data.surveys.queue },
          ]}
          attention={[
            data.surveys.failed_open > 0 && `${data.surveys.failed_open} שליחות נכשלו, לבדיקה`,
          ]}
          toggle={isAdmin ? {
            enabled: data.surveys.enabled,
            busy: toggle.isPending,
            onToggle: () => toggle.mutate({ engine: 'surveys', enabled: !data.surveys.enabled }),
          } : undefined}
        />

        {/* ── הנהג בדרך אליך ── */}
        <EngineCard
          icon={Truck}
          title="הנהג בדרך אליך"
          description="נהג שסוגר עצירה שולח ללקוח הבא בתור הודעה שהוא בדרך. מיידי, פעם אחת לעצירה."
          state={onWayState}
          lastRun={sinceLabel(data.on_way.last_run_at, now)}
          numbers={[
            { label: 'יצאו היום', value: data.on_way.sent_today },
            { label: 'יצאו (7 ימים)', value: data.on_way.sent_7d },
            { label: 'דולגו היום', value: data.on_way.skipped_today },
          ]}
          attention={[]}
          toggle={isAdmin ? {
            enabled: data.on_way.enabled,
            busy: toggle.isPending,
            onToggle: () => toggle.mutate({ engine: 'on_way', enabled: !data.on_way.enabled }),
          } : undefined}
        />

        {/* ── תזכורת יום לפני ── */}
        <EngineCard
          icon={CalendarClock}
          title="תזכורת יום לפני אספקה"
          description="רץ כל ערב ב-18:30 על יומן המחר. כבוי עד שתבנית התזכורת תאושר ותוחלט הדלקה."
          state={{ label: 'כבוי (מנוהל בקוד)', tone: 'gray' }}
          lastRun={sinceLabel(data.reminders.last_at, now)}
          numbers={[
            { label: 'יצאו (7 ימים)', value: data.reminders.sent_7d },
          ]}
          attention={[]}
        />

        {/* ── שליחות ידניות ── */}
        <EngineCard
          icon={Hand}
          title="שליחות ידניות"
          description="תיאום הגעה מהמסכים, החלונית שבפריוריטי, והתיבה. אדם לוחץ, לא אוטומט."
          state={{ label: 'ידני', tone: 'green' }}
          lastRun={sinceLabel(data.manual.last_at, now)}
          numbers={[
            { label: 'יצאו (7 ימים)', value: data.manual.sent_7d },
          ]}
          attention={[]}
        />
      </div>

      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <MessageSquare className="h-3.5 w-3.5" />
        כיבוי מנוע נכנס לתוקף בריצה הבאה שלו (עד רבע שעה). ההרשאות נאכפות במסד, לא במסך.
      </p>
    </div>
  );
}

function EngineCard({
  icon: Icon,
  title,
  description,
  state,
  lastRun,
  numbers,
  attention,
  toggle,
}: {
  icon: typeof Camera;
  title: string;
  description: string;
  state: { label: string; tone: 'green' | 'amber' | 'gray' };
  lastRun: string;
  numbers: { label: string; value: number }[];
  attention: (string | false)[];
  toggle?: { enabled: boolean; busy: boolean; onToggle: () => void };
}) {
  const issues = attention.filter(Boolean) as string[];
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-slate-100 p-2">
              <Icon className="h-4 w-4 text-slate-600" />
            </span>
            <div>
              <h2 className="text-[15px] font-bold text-slate-900">{title}</h2>
              <p className="text-[11.5px] leading-snug text-muted-foreground">{description}</p>
            </div>
          </div>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${ENGINE_STATE_CLASS[state.tone]}`}>
            {state.label}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {numbers.map((n) => (
            <div key={n.label} className="rounded-lg bg-slate-50 px-2 py-1.5 text-center">
              <div className="text-lg font-bold text-slate-900">{n.value}</div>
              <div className="text-[10px] leading-tight text-muted-foreground">{n.label}</div>
            </div>
          ))}
        </div>

        {issues.length > 0 && (
          <div className="space-y-1">
            {issues.map((t) => (
              <p key={t} className="flex items-center gap-1.5 rounded bg-amber-50 px-2 py-1 text-[11.5px] text-amber-900">
                <AlertTriangle className="h-3 w-3 shrink-0" /> {t}
              </p>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">
            {lastRun ? `ריצה אחרונה: ${lastRun}` : 'טרם רץ'}
          </span>
          {toggle && (
            <Button
              size="sm"
              variant={toggle.enabled ? 'outline' : 'default'}
              disabled={toggle.busy}
              onClick={() => {
                // עצירת מנוע ששולח ללקוחות היא פעולה מודעת, לא לחיצה שוגה.
                if (toggle.enabled && !window.confirm(`לכבות את "${title}"? המנוע יפסיק לשלוח מהריצה הבאה.`)) return;
                toggle.onToggle();
              }}
            >
              {toggle.busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : toggle.enabled ? 'כבה' : 'הדלק'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
