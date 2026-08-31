import { MessageCircle } from 'lucide-react';
import type { Survey } from '@/lib/surveys';
import { waChatUrl } from '@/lib/wa-chat-link';

const NAVY = '#14223a';

/**
 * "מה הלקוחות כתבו" כרשימה (בקשת עידן, 31/08/2026): שם הלקוח, מספר
 * הלקוח בפריוריטי, וכפתור שפותח מיד שיחת וואטסאפ עם הלקוח.
 *
 * 🔴 שורת השם עוטפת (flex-wrap) ולא נחתכת: חיתוך היה בולע את מספר
 * הלקוח ואת הציון, בדיוק הבאג של כפתור "כרטיס" מאתמול.
 * 🔴 לקוח בלי נייד תקין מקבל תווית "אין נייד" ולא כפתור שקט שנעלם:
 * היעדר חייב לדבר.
 */
export function CustomerCommentsList({ rows }: { rows: Survey[] }) {
  if (rows.length === 0) {
    return <p className="py-8 text-center text-xs text-slate-400">אין עדיין הערות חופשיות</p>;
  }
  return (
    <div className="divide-y" style={{ borderColor: '#eef1f6' }}>
      {rows.map((s) => {
        const url = waChatUrl(s.phoneE164);
        const low = (s.satisfaction ?? 5) <= 3;
        return (
          <div key={s.id} className="flex items-start gap-3 py-2.5 first:pt-1 last:pb-1">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="text-[13px] font-bold" style={{ color: NAVY }}>
                  {s.customerName ?? 'לקוח'}
                </span>
                {s.customerNumber && (
                  <bdi className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">
                    {s.customerNumber}
                  </bdi>
                )}
                {s.satisfaction != null && (
                  <span
                    className="rounded-full px-2 py-0.5 text-[10.5px] font-bold"
                    style={{
                      background: low ? '#fee2e2' : '#dcfce7',
                      color: low ? '#b91c1c' : '#166534',
                    }}
                  >
                    {s.satisfaction} מתוך 5
                  </span>
                )}
                {s.answeredAt && (
                  <span className="text-[11px] text-slate-400">{commentDate(s.answeredAt)}</span>
                )}
              </div>
              {s.comment && (
                <p className="mt-0.5 text-[13px] leading-snug text-slate-600">{s.comment}</p>
              )}
            </div>
            {url ? (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-emerald-700"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                וואטסאפ
              </a>
            ) : (
              <span className="shrink-0 rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-400">
                אין נייד
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function commentDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return `היום ${time}`;
  // 🔴 עם שנה. הרשימה ממוינת מהחדש לישן, ובלי שנה קל להניח שהכל מהשבוע.
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()} ${time}`;
}
