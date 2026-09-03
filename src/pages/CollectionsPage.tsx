/**
 * גיול חובות ומסך הגבייה.
 *
 * שלומי, <bdi>20/08/2026</bdi>: לדעת מי חייב, כמה זמן, ומה נעשה בנידון.
 *
 * 🔴🔴 **המסך הזה אומר במפורש שהוא אינו ספר החשבונות, וזה לא ניסוח זהיר
 * אלא עובדה שנמדדה.** הצלבה מול דוח הגיול של פריוריטי
 * (<bdi>27/08/2026</bdi>) נתנה <bdi>7,272,096</bdi> אצלנו מול
 * <bdi>7,172,946</bdi> בדוח, פער של <bdi>1.4%</bdi>, ושישה לקוחות תאמו
 * לשקל. אבל משרד הביטחון הראה אצלנו <bdi>390</bdi> אלף מול
 * <bdi>264</bdi> אלף בדוח. הפער הוא זיכויים שמקזזים בלי לסמן התאמה,
 * וחלקם פשוט אינם מגיעים אלינו.
 *
 * ⭐ ולכן המסך הזה הוא **מסך עבודה של גבייה** ולא מקור אמת חשבונאי: הוא
 * אומר למי להתקשר ומתי, והמספר המחייב נלקח מפריוריטי.
 * [[demo_mirror_drifts_from_source]]
 *
 * 🔴 **וכל הכסף כאן נחתך בשרת.** ה-RPC הוא `security invoker`, ולכן
 * ה-RLS של `consolidated_invoices` (הנהלה בלבד) חל עליו מעצמו. מי שאינו
 * מורשה מקבל רשימה ריקה, ולא סכום שהוסתר ב-CSS.
 */
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CalendarClock,
  Coins,
  FileClock,
  Info,
  Loader2,
  MessageSquarePlus,
  Phone,
  Receipt,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AGING_BUCKETS,
  BUCKET_LABELS,
  bucketOf,
  bucketTotals,
  overdueTotal,
  shekel,
  type AgingBucket,
} from '@/lib/aging';
import {
  addNote,
  fetchAging,
  fetchCustomerOpenInvoices,
  fetchNotes,
  OUTCOMES,
  OUTCOME_LABELS,
  type AgingRow,
  type CollectionOutcome,
} from '@/lib/collections';
import { fetchCustomerReceipts, fetchDebtDrafts, fetchReceiptsByMonth } from '@/lib/receipts';
import { receiptKindLabel, receiptsFrom, summarizeReceipts } from '@/lib/receipts-summary';
import { useCurrentProfile } from '@/hooks/useProfile';

const NAVY = '#14223a';

/** ⭐ צבע רק לדליים שמצדיקים טלפון. צבע על הכל אינו צבע. */
const BUCKET_TONE: Record<AgingBucket, string> = {
  b0_30: 'text-slate-500',
  b31_60: 'text-slate-600',
  b61_90: 'text-amber-700',
  b91_120: 'text-orange-700',
  b120_plus: 'text-red-700',
};

function dayLabel(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
}

function Stat({ n, t, color }: { n: React.ReactNode; t: string; color?: string }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-extrabold leading-none" style={{ color: color ?? NAVY }}>
        {n}
      </div>
      <div className="mt-1 text-[11px] text-slate-400">{t}</div>
    </div>
  );
}

export function CollectionsPage() {
  const qc = useQueryClient();
  const { data: profile } = useCurrentProfile();
  const [search, setSearch] = useState('');
  const [openCustomer, setOpenCustomer] = useState<AgingRow | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['debt-aging'],
    queryFn: fetchAging,
    staleTime: 60_000,
  });
  // ⭐ קבלות וטיוטות בשתי שליפות נפרדות: כישלון באחת לא מפיל את החוב.
  const { data: receiptRows = [], isLoading: loadingReceipts } = useQuery({
    queryKey: ['receipts-by-month'],
    queryFn: () => fetchReceiptsByMonth(receiptsFrom()),
    staleTime: 60_000,
  });
  const { data: drafts = [] } = useQuery({
    queryKey: ['debt-drafts'],
    queryFn: fetchDebtDrafts,
    staleTime: 60_000,
  });
  const receipts = useMemo(() => summarizeReceipts(receiptRows), [receiptRows]);
  const draftsTotal = useMemo(
    () => ({ n: drafts.reduce((a, d) => a + d.draftCount, 0), total: drafts.reduce((a, d) => a + d.total, 0) }),
    [drafts],
  );

  const filtered = useMemo(() => {
    const q = search.trim();
    if (!q) return rows;
    return rows.filter(
      (r) => r.customerName.includes(q) || r.customerNumber.includes(q)
    );
  }, [rows, search]);

  // ⭐ הסיכום נגזר מאותן פונקציות שנבדקות ביחידה, ולא מלולאה מקומית.
  // סכום שמחושב פעם שנייה במסך הוא הדרך הקצרה לכך שהכותרת והשורות
  // יתחילו לספר סיפורים שונים. [[label_and_math_from_two_mechanisms]]
  const totals = useMemo(
    () => ({
      total: rows.reduce((s, r) => s + r.total, 0),
      overdue: overdueTotal(rows),
      buckets: bucketTotals(rows),
    }),
    [rows]
  );

  const needsAction = useMemo(
    () => rows.filter((r) => r.nextActionDate && r.nextActionDate <= new Date().toISOString().slice(0, 10)),
    [rows]
  );

  return (
    <div
      style={{ background: '#f5f7fb' }}
      className="-mx-4 -my-6 min-h-screen px-4 py-5 sm:-mx-6 sm:px-6"
    >
      <div className="mb-4 px-1">
        <div className="text-xl font-extrabold" style={{ color: NAVY }}>
          גיול חובות וגבייה
        </div>
        <div className="text-[11px] text-slate-400">
          חשבוניות מרכזות פתוחות{isLoading ? ' · טוען…' : ''}
        </div>
      </div>

      {/* 🔴 ההסתייגות בראש המסך ולא בהערת שוליים. מי שקורא מספר כספי
          ומתקשר לפיו חייב לדעת מאיפה הוא בא לפני שהוא מרים טלפון. */}
      <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12px] leading-relaxed text-amber-900">
        <Info className="mt-0.5 h-4 w-4 flex-none" />
        <span>
          המספרים כאן נכונים לסנכרון האחרון מפריוריטי ומיועדים לעבודת הגבייה, לא לדיווח
          חשבונאי. זיכויים ממסך חשבוניות המס (לקוחות פרטיים) אינם נכללים, ולכן לקוח כזה עשוי
          להיראות חייב יותר. טיוטות שטרם הופקו אינן חוב ומוצגות בנפרד.{' '}
          <b>לסכום המחייב עובדים מול פריוריטי.</b>
        </span>
      </div>

      <div
        className="mb-4 rounded-2xl border bg-white p-5 shadow-sm"
        style={{ borderColor: '#eef1f6' }}
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat n={shekel(totals.total)} t="חוב פתוח" />
          <Stat
            n={shekel(totals.overdue)}
            t="מעל 60 יום"
            color={totals.overdue > 0 ? '#c2410c' : undefined}
          />
          <Stat n={rows.length} t="לקוחות" />
          <Stat
            n={needsAction.length}
            t="ממתינים למעקב"
            color={needsAction.length > 0 ? '#c2410c' : undefined}
          />
        </div>

        <div className="mt-4 grid grid-cols-5 gap-2 border-t pt-3" style={{ borderColor: '#eef1f6' }}>
          {AGING_BUCKETS.map((b) => (
            <div key={b} className="text-center">
              <div className={`text-sm font-bold ${BUCKET_TONE[b]}`}>
                <bdi>{shekel(totals.buckets[b])}</bdi>
              </div>
              <div className="mt-0.5 text-[10px] text-slate-400">{BUCKET_LABELS[b]}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ⭐ שני הצדדים של אותו כסף על אותו מסך: מה נכנס (קבלות מהספר
          הכספי) ומה עוד לא יצא (טיוטות). שלומי, 03/09/2026. */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: '#eef1f6' }}>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-sm font-bold" style={{ color: NAVY }}>
                <Receipt className="h-4 w-4 text-emerald-700" />
                נגבה
              </div>
              <div className="text-[11px] text-slate-400">
                קבלות וחשבוניות מס קבלה מהספר הכספי בפריוריטי{loadingReceipts ? ' · טוען…' : ''}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Stat n={<bdi>{shekel(receipts.thisMonth)}</bdi>} t={`החודש · ${receipts.thisMonthCount} קבלות`} color="#047857" />
            <Stat n={<bdi>{shekel(receipts.prevMonth)}</bdi>} t="חודש קודם" />
          </div>
          {receipts.byCustomer.length > 0 ? (
            <table className="mt-3 w-full border-t text-xs" style={{ borderColor: '#eef1f6' }}>
              <thead>
                <tr className="text-[10px] text-slate-400">
                  <th className="pt-2 pb-1 text-start font-medium">לקוח</th>
                  <th className="pt-2 pb-1 text-start font-medium">החודש</th>
                  <th className="pt-2 pb-1 text-start font-medium">חודש קודם</th>
                </tr>
              </thead>
              <tbody>
                {receipts.byCustomer.slice(0, 6).map((c) => (
                  <tr key={c.customerNumber} className="border-t" style={{ borderColor: '#f1f4f9' }}>
                    <td className="py-1.5 font-semibold" style={{ color: NAVY }}>{c.customerName}</td>
                    <td className={`py-1.5 ${c.thisMonth ? 'text-emerald-700 font-semibold' : 'text-slate-300'}`}>
                      <bdi>{c.thisMonth ? shekel(c.thisMonth) : '·'}</bdi>
                    </td>
                    <td className={`py-1.5 ${c.prevMonth ? 'text-slate-600' : 'text-slate-300'}`}>
                      <bdi>{c.prevMonth ? shekel(c.prevMonth) : '·'}</bdi>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : !loadingReceipts ? (
            <p className="mt-3 border-t pt-3 text-center text-[11px] text-slate-400" style={{ borderColor: '#eef1f6' }}>
              אין קבלות בחודשיים האחרונים, או שהספר הכספי טרם נמשך.
            </p>
          ) : null}
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: '#eef1f6' }}>
          <div className="mb-3">
            <div className="flex items-center gap-1.5 text-sm font-bold" style={{ color: NAVY }}>
              <FileClock className="h-4 w-4 text-slate-500" />
              ממתין להפקה
            </div>
            <div className="text-[11px] text-slate-400">
              חשבוניות מרכזות בטיוטא. עוד לא יצאו לקופה, ולכן אינן נספרות בחוב.
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Stat n={<bdi>{shekel(draftsTotal.total)}</bdi>} t="סכום בטיוטות" />
            <Stat n={draftsTotal.n} t="טיוטות" />
          </div>
          {drafts.length > 0 ? (
            <table className="mt-3 w-full border-t text-xs" style={{ borderColor: '#eef1f6' }}>
              <tbody>
                {drafts.slice(0, 6).map((d) => (
                  <tr key={d.customerNumber} className="border-t" style={{ borderColor: '#f1f4f9' }}>
                    <td className="py-1.5 font-semibold" style={{ color: NAVY }}>{d.customerName}</td>
                    <td className="py-1.5 text-slate-500"><bdi>{d.draftCount}</bdi> טיוטות</td>
                    <td className="py-1.5 text-slate-500">מ-<bdi>{dayLabel(d.oldestDate)}</bdi></td>
                    <td className="py-1.5 font-semibold" style={{ color: NAVY }}><bdi>{shekel(d.total)}</bdi></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="mt-3 border-t pt-3 text-center text-[11px] text-slate-400" style={{ borderColor: '#eef1f6' }}>
              אין טיוטות ממתינות.
            </p>
          )}
        </div>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute inset-y-0 start-2.5 my-auto h-4 w-4 text-slate-400" />
          <Input
            dir="rtl"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש לפי שם או מספר לקוח"
            className="bg-white ps-9"
          />
        </div>
      </div>

      {/* ⭐ המצב הריק מסביר את עצמו: אפס חוב וחוסר הרשאה נראים אחרת לגמרי
          אם לא אומרים את זה. [[empty_state_must_speak]] */}
      {!isLoading && rows.length === 0 && (
        <div className="rounded-2xl border bg-white p-10 text-center text-xs text-slate-400" style={{ borderColor: '#eef1f6' }}>
          אין חשבוניות פתוחות להצגה.
          <br />
          המסך פתוח להנהלה בלבד; אם אתה רואה את זה ואמור לראות נתונים, זו הרשאה ולא נתונים.
        </div>
      )}

      {filtered.length > 0 && (
      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm" style={{ borderColor: '#eef1f6' }}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b text-[11px] text-slate-400" style={{ borderColor: '#eef1f6' }}>
                <th className="p-3 text-start font-medium">לקוח</th>
                <th className="p-3 text-start font-medium">חוב</th>
                <th className="p-3 text-start font-medium">ותק</th>
                {AGING_BUCKETS.map((b) => (
                  <th key={b} className="p-3 text-start font-medium">
                    {BUCKET_LABELS[b]}
                  </th>
                ))}
                <th className="p-3 text-start font-medium">מעקב</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.customerNumber}
                  onClick={() => setOpenCustomer(r)}
                  className="cursor-pointer border-b transition-colors last:border-0 hover:bg-slate-50"
                  style={{ borderColor: '#f1f4f9' }}
                >
                  <td className="p-3">
                    <div className="font-semibold" style={{ color: NAVY }}>
                      {r.customerName}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      <bdi>{r.customerNumber}</bdi> · <bdi>{r.openCount}</bdi> חשבוניות
                    </div>
                  </td>
                  <td className="p-3 font-bold" style={{ color: NAVY }}>
                    <bdi>{shekel(r.total)}</bdi>
                  </td>
                  <td className={`p-3 text-xs font-semibold ${BUCKET_TONE[bucketOf(r.oldestDays)]}`}>
                    <bdi>{r.oldestDays}</bdi> ימים
                  </td>
                  {AGING_BUCKETS.map((b) => (
                    <td key={b} className={`p-3 text-xs ${r.buckets[b] ? BUCKET_TONE[b] : 'text-slate-300'}`}>
                      <bdi>{r.buckets[b] ? shekel(r.buckets[b]) : '·'}</bdi>
                    </td>
                  ))}
                  <td className="p-3 text-[11px]">
                    {r.nextActionDate ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-800">
                        <CalendarClock className="h-3 w-3" />
                        <bdi>{dayLabel(r.nextActionDate)}</bdi>
                      </span>
                    ) : r.lastNoteAt ? (
                      <span className="text-slate-400">
                        תועד <bdi>{dayLabel(r.lastNoteAt)}</bdi>
                      </span>
                    ) : (
                      <span className="text-slate-300">לא תועד</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {rows.length > 0 && filtered.length === 0 && (
        <div className="rounded-2xl border bg-white p-10 text-center text-xs text-slate-400" style={{ borderColor: '#eef1f6' }}>
          אין לקוח שתואם את החיפוש.
        </div>
      )}

      {openCustomer && (
        <CustomerDebtDialog
          row={openCustomer}
          userName={profile?.fullName ?? null}
          onClose={() => setOpenCustomer(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: ['debt-aging'] })}
        />
      )}
    </div>
  );
}

/** מיוצא כדי שאפשר יהיה לצלם אותו לבדו. [[screenshot_behind_a_login]] */
export function CustomerDebtDialog({
  row,
  userName,
  onClose,
  onSaved,
}: {
  row: AgingRow;
  userName: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const [note, setNote] = useState('');
  const [outcome, setOutcome] = useState<CollectionOutcome>('promised');
  const [nextDate, setNextDate] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: invoices = [], isLoading: loadingInv } = useQuery({
    queryKey: ['open-invoices', row.customerNumber],
    queryFn: () => fetchCustomerOpenInvoices(row.customerNumber),
  });
  const { data: notes = [] } = useQuery({
    queryKey: ['collection-notes', row.customerNumber],
    queryFn: () => fetchNotes(row.customerNumber),
  });
  const { data: customerReceipts = [] } = useQuery({
    queryKey: ['customer-receipts', row.customerNumber],
    queryFn: () => fetchCustomerReceipts(row.customerNumber),
  });

  const save = async () => {
    if (!note.trim() || saving) return;
    setSaving(true);
    try {
      await addNote({
        customerNumber: row.customerNumber,
        customerName: row.customerName,
        note,
        outcome,
        nextActionDate: nextDate || null,
        createdByName: userName,
      });
      setNote('');
      setNextDate('');
      toast.success('התיעוד נשמר');
      qc.invalidateQueries({ queryKey: ['collection-notes', row.customerNumber] });
      onSaved();
    } catch (err) {
      // 🔴 הסיבה על המסך: אחרת נראה כאילו הכפתור לא עשה כלום.
      toast.error(err instanceof Error ? err.message : 'שמירת התיעוד נכשלה');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl" className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader className="sm:text-start">
          <DialogTitle className="flex items-center gap-2" style={{ color: NAVY }}>
            <Coins className="h-5 w-5 text-blue-700" />
            {row.customerName}
          </DialogTitle>
          <DialogDescription>
            <bdi>{row.customerNumber}</bdi> · חוב פתוח <bdi>{shekel(row.total)}</bdi> ·
            הישנה ביותר לפני <bdi>{row.oldestDays}</bdi> ימים
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <h4 className="mb-2 text-sm font-bold" style={{ color: NAVY }}>
              חשבוניות פתוחות
            </h4>
            <div className="max-h-72 overflow-y-auto rounded-xl border" style={{ borderColor: '#eef1f6' }}>
              {loadingInv ? (
                <p className="py-8 text-center text-xs text-slate-400">טוען…</p>
              ) : invoices.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-400">אין חשבוניות פתוחות</p>
              ) : (
                invoices.map((inv, i) => (
                  <div
                    key={`${inv.docNo}-${i}`}
                    className="flex items-center justify-between border-b px-3 py-2 text-xs last:border-0"
                    style={{ borderColor: '#f1f4f9' }}
                  >
                    <div>
                      <div className="font-semibold" style={{ color: NAVY }}>
                        <bdi>{inv.docNo || '—'}</bdi>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        <bdi>{dayLabel(inv.invoiceDate)}</bdi>
                        {inv.sourceOrder && (
                          <>
                            {' · הזמנה '}
                            <bdi>{inv.sourceOrder}</bdi>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-start">
                      <div className="font-bold" style={{ color: NAVY }}>
                        <bdi>{shekel(inv.totalPrice)}</bdi>
                      </div>
                      <div className={`text-[11px] font-semibold ${BUCKET_TONE[bucketOf(inv.ageDays)]}`}>
                        <bdi>{inv.ageDays}</bdi> ימים
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <h4 className="mb-2 mt-4 flex items-center gap-1.5 text-sm font-bold" style={{ color: NAVY }}>
              <Receipt className="h-4 w-4 text-emerald-700" />
              קבלות בשנה האחרונה
            </h4>
            <div className="max-h-44 overflow-y-auto rounded-xl border" style={{ borderColor: '#eef1f6' }}>
              {customerReceipts.length === 0 ? (
                <p className="py-5 text-center text-xs text-slate-400">לא נמצאו קבלות</p>
              ) : (
                customerReceipts.map((rc, i) => (
                  <div
                    key={`${rc.docNo}-${i}`}
                    className="flex items-center justify-between border-b px-3 py-2 text-xs last:border-0"
                    style={{ borderColor: '#f1f4f9' }}
                  >
                    <div>
                      <div className="font-semibold" style={{ color: NAVY }}>
                        <bdi>{rc.docNo || '·'}</bdi>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        <bdi>{dayLabel(rc.receiptDate)}</bdi> · {receiptKindLabel(rc.docNo, rc.docType)}
                      </div>
                    </div>
                    <div className={`font-bold ${rc.totalPrice < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                      <bdi>{shekel(rc.totalPrice)}</bdi>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <h4 className="mb-2 flex items-center gap-1.5 text-sm font-bold" style={{ color: NAVY }}>
              <Phone className="h-4 w-4 text-slate-400" />
              תיעוד גבייה
            </h4>

            <div className="rounded-xl border p-3" style={{ borderColor: '#eef1f6' }}>
              <Textarea
                dir="rtl"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="מה נאמר בשיחה…"
                className="min-h-16"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {OUTCOMES.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setOutcome(o.value)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      outcome === o.value
                        ? 'border-blue-600 bg-blue-50 text-blue-800'
                        : 'border-slate-200 bg-white text-slate-500'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <label className="text-[11px] text-slate-500">מעקב בתאריך</label>
                <Input
                  type="date"
                  value={nextDate}
                  onChange={(e) => setNextDate(e.target.value)}
                  className="h-8 w-40 text-xs"
                />
              </div>
              <Button
                onClick={save}
                disabled={!note.trim() || saving}
                className="mt-2 w-full gap-1"
                size="sm"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquarePlus className="h-4 w-4" />}
                שמור תיעוד
              </Button>
            </div>

            <div className="mt-3 max-h-52 space-y-2 overflow-y-auto">
              {notes.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-400">טרם תועדה שיחה מול הלקוח הזה</p>
              ) : (
                notes.map((n) => (
                  <div key={n.id} className="rounded-lg border p-2.5 text-xs" style={{ borderColor: '#eef1f6' }}>
                    <div className="mb-1 flex items-center gap-2 text-[11px] text-slate-400">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">
                        {OUTCOME_LABELS[n.outcome]}
                      </span>
                      <bdi>{dayLabel(n.createdAt)}</bdi>
                      {n.createdByName && <span>· {n.createdByName}</span>}
                    </div>
                    <p className="whitespace-pre-wrap text-slate-700">{n.note}</p>
                    {n.nextActionDate && (
                      <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                        <AlertTriangle className="h-3 w-3" />
                        מעקב ב-<bdi>{dayLabel(n.nextActionDate)}</bdi>
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            סגור
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
