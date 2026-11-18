import { useState } from 'react';
import { AlertCircle, Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { REPORT_FUNDS, compareSources, defaultReportPeriod, type PickupsReport } from '@/lib/pickups-report';
import { downloadPickupsReport, fetchPickupsReport } from '@/lib/pickups-report-fetch';

/**
 * טענה: "הדוח החודשי לקופה יוצא מהמערכת, ובתקופת ההרצה רואים מיד מה נסגר רק
 * בפריוריטי ומה רק באפליקציה" (שלומי 17/11, עידן 18/11/2026).
 * המוקד הוא שלושת המספרים של ההשוואה; הקובץ עצמו יורד בלחיצה.
 */
export function PickupsReportPage() {
  const initial = defaultReportPeriod(new Date());
  const [fund, setFund] = useState<string>('מכבי');
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const q = useQuery({
    queryKey: ['pickupsReport', fund, from, to],
    queryFn: () => fetchPickupsReport(fund, from, to),
    enabled: !!from && !!to && from <= to,
    staleTime: 60_000,
  });

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
          דוח איסופים לקופה
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          הקובץ שעובר לקופה ב-10 לכל חודש. בתקופת ההרצה הוא נבנה משני מקורות: מה שנסגר באפליקציה (עם הסריאלי
          והסיבה מטופס ההחזרה) ומה שנסגר בפריוריטי.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
        <label className="space-y-1 text-xs text-muted-foreground">
          קופה
          <select
            value={fund}
            onChange={(e) => setFund(e.target.value)}
            className="block h-10 rounded-md border bg-background px-2 text-base text-foreground sm:text-sm"
          >
            {REPORT_FUNDS.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          מתאריך
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10 text-base sm:text-sm" />
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          עד תאריך
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10 text-base sm:text-sm" />
        </label>
        <Button className="ms-auto h-10 gap-1.5" disabled={!q.data} onClick={() => q.data && downloadPickupsReport(q.data)}>
          <Download className="h-4 w-4" />
          הורדת אקסל
        </Button>
      </div>

      {q.isLoading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          בונה את הדוח…
        </div>
      ) : q.error ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" />
          {q.error.message}
        </div>
      ) : q.data ? (
        <ReportSummary r={q.data} />
      ) : null}
    </div>
  );
}

function ReportSummary({ r }: { r: PickupsReport }) {
  const cmp = compareSources(r);
  const missing = r.app.filter((x) => !x.serial || !x.reason).length;
  const stats = [
    { label: 'נסגרו בשני המקורות', value: cmp.both.length, tone: 'text-emerald-700' },
    { label: 'רק בפריוריטי', value: cmp.priorityOnly.length, tone: cmp.priorityOnly.length ? 'text-amber-700' : 'text-slate-500' },
    { label: 'רק באפליקציה', value: cmp.appOnly.length, tone: cmp.appOnly.length ? 'text-amber-700' : 'text-slate-500' },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border bg-card p-3">
            <div className={`text-3xl font-bold tabular-nums ${s.tone}`}>{s.value}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        מהמערכת: <span className="font-semibold text-foreground tabular-nums">{r.app.length}</span> שורות, מהן{' '}
        <span className="font-semibold text-foreground tabular-nums">{missing}</span> בלי סריאלי או סיבה (מסומנות בעמודה
        "חסר להשלמה"). מפריוריטי: <span className="font-semibold text-foreground tabular-nums">{r.priority.length}</span> שורות.
      </p>
      {(cmp.priorityOnly.length > 0 || cmp.appOnly.length > 0) && (
        <section className="rounded-lg border bg-card">
          <div className="border-b px-4 py-2 text-sm font-semibold">פערים לבדיקה</div>
          <ul className="divide-y text-sm">
            {cmp.priorityOnly.map((x) => (
              <GapLine key={`p-${x.rt}`} rt={x.rt} name={x.name} date={x.picked} what="נסגר בפריוריטי, לא באפליקציה" />
            ))}
            {cmp.appOnly.map((x) => (
              <GapLine key={`a-${x.rt}`} rt={x.rt} name={x.name} date={x.picked} what="נסגר באפליקציה, לא בפריוריטי" />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function GapLine({ rt, name, date, what }: { rt: string | null; name: string; date: string; what: string }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2">
      <bdi className="w-24 font-mono text-xs text-muted-foreground">{rt ?? 'בלי תעודה'}</bdi>
      <span className="font-medium">{name}</span>
      <bdi className="text-xs text-muted-foreground">{date.split('-').reverse().join('/')}</bdi>
      <span className="ms-auto text-xs text-amber-700">{what}</span>
    </li>
  );
}
