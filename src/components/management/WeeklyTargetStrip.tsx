import type { TargetStatus } from '@/lib/delivery-target';

/**
 * ─── רצועת היעד השבועי בכרטיס האספקות ───────────────────────────────────
 *
 * ⭐ **הסימן החשוב כאן אינו המילוי אלא הסימון האנכי**: הוא מראה איפה
 * אמורים להיות עכשיו לפי קצב השבוע האמיתי. בלעדיו הסרגל אומר "58%",
 * וזה מספר שלא ניתן לעשות איתו כלום ביום רביעי בבוקר.
 *
 * 🔴 **הצבע נגזר מהתחזית ולא מהמילוי**, אחרת כל תחילת שבוע צבועה אדום
 * ותוך שבועיים המדד הופך לטפט.
 */

const COLORS = {
  ahead: { main: '#16a34a', soft: '#dcfce7', label: 'לפני היעד' },
  on_track: { main: '#16a34a', soft: '#dcfce7', label: 'בקצב' },
  behind: { main: '#e0a800', soft: '#fef3c7', label: 'מתחת לקצב' },
} as const;

export function WeeklyTargetStrip({
  s, history,
}: {
  s: TargetStatus;
  history: { weekStart: string; count: number }[];
}) {
  const c = COLORS[s.verdict];
  const expectedPct = Math.min(100, Math.round((s.expected / s.target) * 100));
  // 🔴 הגג גבוה מהיעד ב-10%, אחרת קו היעד יושב בדיוק על שפת התיבה,
  // גולש מעליה ומתנגש בשורת הטקסט (נתפס בצילום, 02/09).
  const peak = Math.max(s.target, ...history.map((h) => h.count), 1) * 1.1;
  const targetPct = Math.round((s.target / peak) * 100);

  return (
    <div className="col-span-2 mt-3 border-t pt-3" style={{ borderColor: '#f0f3f8' }}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-[11px] text-slate-500">יעד שבועי · תעודות משלוח</span>
        <span className="flex items-baseline gap-1.5">
          <span className="text-[15px] font-bold" style={{ color: c.main }}>{s.actual}</span>
          <span className="text-[11px] text-slate-400">מתוך {s.target}</span>
          <span
            className="rounded-full px-2 py-[1px] text-[10px] font-bold"
            style={{ background: c.soft, color: c.main }}
          >
            {c.label}
          </span>
        </span>
      </div>

      {/* הסרגל: מילוי בפועל, וסימון אנכי במקום שבו הקצב אמור להיות */}
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="absolute inset-y-0 rounded-full"
          style={{ insetInlineStart: 0, width: `${s.pct}%`, background: c.main }}
        />
        <div
          className="absolute inset-y-0 w-[2px]"
          style={{ insetInlineStart: `${expectedPct}%`, background: '#334155' }}
          title={`צפוי עד עכשיו ${s.expected}`}
        />
      </div>

      <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500">
        <span>
          צפוי עד עכשיו <b className="text-slate-700">{s.expected}</b>
          {s.gap !== 0 && (
            <span style={{ color: s.gap > 0 ? '#16a34a' : '#e0a800' }}>
              {' '}({s.gap > 0 ? '+' : ''}{s.gap})
            </span>
          )}
        </span>
        <span>
          {s.projected != null
            ? <>תחזית לסגירת השבוע <b style={{ color: c.main }}>{s.projected}</b></>
            : 'מוקדם מכדי לחזות'}
        </span>
      </div>

      {/* שמונה השבועות שקדמו, עם קו היעד.
          🔴 **בלי קו היעד הרצועה חסרת משמעות**: היא מראה שהשבועות דומים
          זה לזה ולא כמה רחוקים כולם מ-147, וזו כל השאלה. */}
      <div className="relative mt-2.5" style={{ height: 56 }}>
        <div className="flex h-full items-end gap-[5px]" aria-hidden>
          {history.map((h) => (
            <div
              key={h.weekStart}
              className="flex-1 rounded-t-[3px]"
              style={{
                height: `${Math.max(6, Math.round((h.count / peak) * 100))}%`,
                background: h.count >= s.target ? '#16a34a' : '#94a3b8',
              }}
              title={`שבוע ${h.weekStart}: ${h.count} תעודות`}
            />
          ))}
        </div>
        <div
          className="pointer-events-none absolute inset-x-0 border-t border-dashed"
          style={{ bottom: `${targetPct}%`, borderColor: '#94a3b8' }}
        />
        <span
          className="pointer-events-none absolute bg-white px-1 text-[9px] font-bold leading-none text-slate-400"
          style={{ insetInlineStart: 0, bottom: `${targetPct}%`, transform: 'translateY(50%)' }}
        >
          יעד {s.target}
        </span>
      </div>
      {/* 🔴 בלי שני הקצוות אי אפשר לדעת איזה צד הוא העבר. הרצועה נקראת
          מימין לשמאל כמו הטקסט, והכיתוב הוא מה שאומר את זה. */}
      <div className="mt-1 flex justify-between text-[10px] text-slate-400">
        <span>לפני 8 שבועות</span>
        <span>השבוע שעבר</span>
      </div>
    </div>
  );
}
