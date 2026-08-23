import { useMemo } from 'react';
import { Loader2, ShieldCheck, ShieldAlert, Monitor, Database, Info } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow as TR } from '@/components/ui/table';
import { useSecurityMatrix } from '@/hooks/useSecurityMatrix';
import { SCREEN_ACCESS, type ScreenGroup } from '@/lib/screen-access';
import { ALLOWED_ROLES, ROLE_LABELS, type UserRole } from '@/types/profile';
import {
  summarizeTable, exposureRank, AUDIENCE_LABELS,
  type Audience, type TableVerdict,
} from '@/lib/policy-audience';
import { cn } from '@/lib/utils';

/**
 * מסך ההרשאות.
 *
 * 🔴 **הוא מצלם ולא מגדיר, וזה מכוון.** ההרשאות נאכפות בכללי האבטחה של
 * Postgres, ושם הן נבדקות בכל בקשה. מסך שמחזיק רשימה משלו מתיישן בשקט
 * ברגע שכלל אחד משתנה, ומציג ביטחון שאין לו כיסוי. לכן החלק העליון נקרא
 * מאותו מקור שהנתב עצמו קורא ממנו, והחלק התחתון נקרא מהמסד בזמן אמת.
 *
 * ⭐ **מה שאין כאן: כפתור.** שינוי הרשאה הוא שינוי בכללי המסד, ולכן הוא
 * עובר דרכנו. אם יגיע צורך אמיתי לשנות הרשאות של תפקיד, זה הרגע לעבור
 * לטבלת הרשאות שמזינה את המסד, ולא לכפתור שמסתיר כפתורים.
 */

const GROUP_LABELS: Record<ScreenGroup, string> = {
  daily: 'יומיומי',
  admin: 'ניהול והגדרות',
  field: 'שטח',
};

export function PermissionsPage() {
  const { data, isLoading, error } = useSecurityMatrix();

  const tables = useMemo(() => {
    const list = (data ?? []).map(summarizeTable);
    return list.sort((a, b) => exposureRank(a) - exposureRank(b) || a.tbl.localeCompare(b.tbl));
  }, [data]);

  // 🔴 כתיבה וקריאה נספרות בנפרד. "פתוח לכולם" על טבלה שאפשר לכתוב אליה
  // ועל טבלה שאפשר רק לקרוא ממנה הם שני דברים שונים לגמרי, וספירה אחת
  // הייתה מטשטשת בדיוק את מה שהמסך נועד להראות.
  const writableByAll = tables.filter((t) => t.rlsOff || t.byAudience.get('anyone')?.has('write'));
  const readableByAll = tables.filter(
    (t) => !t.rlsOff && !t.byAudience.get('anyone')?.has('write') && t.byAudience.get('anyone')?.has('read'),
  );
  const unknown = tables.filter((t) => t.hasUnknown);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <ShieldCheck className="h-5 w-5 text-primary" />
          הרשאות
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          מה פתוח למי. הכל נקרא מהמקור שנאכף בפועל, ולא מרשימה שנכתבה בצד.
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          המסך הזה לקריאה בלבד. תפקיד של אדם נקבע במסך{' '}
          <span className="font-semibold text-foreground">משתמשים</span>. מה שמותר לכל
          תפקיד נאכף במסד, ושינוי שלו עובר דרך עוגן סולושנס.
        </span>
      </div>

      {/* ── מסכים ── */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <Monitor className="h-4 w-4 text-muted-foreground" />
          מסכים
        </h2>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TR>
                <TableHead>מסך</TableHead>
                {ALLOWED_ROLES.map((r) => (
                  <TableHead key={r} className="text-center">{ROLE_LABELS[r]}</TableHead>
                ))}
              </TR>
            </TableHeader>
            <TableBody>
              {(['daily', 'admin', 'field'] as ScreenGroup[]).map((g) => (
                <ScreenGroupRows key={g} group={g} />
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* ── נתונים ── */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <Database className="h-4 w-4 text-muted-foreground" />
          נתונים
        </h2>

        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            אין לך הרשאה לקרוא את כללי האבטחה. המסך פתוח למנהל מערכת ולמנהל צוות.
          </p>
        )}

        {!isLoading && !error && (
          <>
            {(writableByAll.length + readableByAll.length + unknown.length > 0) && (
              <div className="rounded-md border border-amber-300 bg-amber-50/70 p-3 text-sm">
                <p className="flex items-center gap-1.5 font-semibold text-amber-800">
                  <ShieldAlert className="h-4 w-4" />
                  {writableByAll.length} טבלאות שכל מי שמחובר יכול גם לכתוב אליהן,
                  ועוד {readableByAll.length} שהוא יכול לקרוא
                  {unknown.length > 0 && `. ${unknown.length} עם כלל שלא זוהה`}
                </p>
                <p className="mt-1 text-xs text-amber-900/80">
                  אין כאן חשיפה החוצה, רק בתוך הצוות: נהג שמחובר בטלפון שלו מגיע
                  לנתונים האלה בדיוק כמו סדרן.
                </p>
              </div>
            )}

            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TR>
                    <TableHead>טבלה</TableHead>
                    <TableHead>מי קורא</TableHead>
                    <TableHead>מי כותב</TableHead>
                  </TR>
                </TableHeader>
                <TableBody>
                  {tables.map((t) => (
                    <DataRow key={t.tbl} v={t} />
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function ScreenGroupRows({ group }: { group: ScreenGroup }) {
  const rows = SCREEN_ACCESS.filter((s) => s.group === group);
  if (rows.length === 0) return null;
  return (
    <>
      <TR>
        <TableCell colSpan={ALLOWED_ROLES.length + 1} className="bg-muted/50 py-1.5 text-xs font-semibold">
          {GROUP_LABELS[group]}
        </TableCell>
      </TR>
      {rows.map((s) => (
        <TR key={s.path}>
          <TableCell>
            <span className="text-sm font-medium">{s.label}</span>
            {/* 🔴 נתיב לטיני צמוד לעברית נדבק למילה. `bdi` עם מפריד מפורש. */}
            <span className="text-[11px] text-muted-foreground"> · </span>
            <bdi className="text-[11px] text-muted-foreground">{s.path}</bdi>
          </TableCell>
          {ALLOWED_ROLES.map((r: UserRole) => (
            <TableCell key={r} className="text-center">
              {s.allow.includes(r) ? (
                <span className="text-emerald-600">✓</span>
              ) : (
                <span className="text-muted-foreground/30">·</span>
              )}
            </TableCell>
          ))}
        </TR>
      ))}
    </>
  );
}

function DataRow({ v }: { v: TableVerdict }) {
  const readers = collect(v, 'read');
  const writers = collect(v, 'write');
  const loud = v.rlsOff || v.byAudience.get('anyone')?.has('write');
  return (
    <TR className={cn(loud && 'bg-amber-50/60', v.closedToPeople && 'opacity-60')}>
      <TableCell className="font-mono text-xs" dir="ltr">{v.tbl}</TableCell>
      <TableCell className="text-xs">{v.rlsOff ? '🔴 הגנת השורות כבויה' : fmt(readers)}</TableCell>
      <TableCell className="text-xs">{v.rlsOff ? '🔴 הגנת השורות כבויה' : fmt(writers)}</TableCell>
    </TR>
  );
}

function collect(v: TableVerdict, access: 'read' | 'write'): Audience[] {
  return [...v.byAudience.entries()]
    .filter(([, set]) => set.has(access))
    .map(([a]) => a)
    .filter((a) => a !== 'service');
}

/** 🔴 רשימה ריקה נאמרת במפורש. תא ריק נראה כמו "לא נבדק". */
function fmt(list: Audience[]): string {
  if (list.length === 0) return 'אף אחד, שרתים בלבד';
  return list.map((a) => AUDIENCE_LABELS[a]).join(' · ');
}
