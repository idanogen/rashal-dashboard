import { MessageSquareWarning, RotateCcw } from 'lucide-react';
import { returnedMeta, type ReturnedInfo } from '@/lib/returned-from-route';

/**
 * מה שהנהג רשם כשסגר עצירה בלי להשלים אותה.
 *
 * ⭐ יושב בכל מקום שבו מופיע החיווי "חזר מהקו", כי חיווי בלי סיבה מחזיר את
 * המנהל לטלפן לנהג ולשאול "למה", וזה בדיוק מה שהדיווח נועד לחסוך.
 *
 * 🔴 **ושני מצבים, לא אחד (27/08/2026).** "לא הגעתי" ו"הגעתי וצריך המשך
 * טיפול" הן שתי בקשות שונות לגמרי מהמשרד: הראשונה אומרת לתאם מחדש,
 * השנייה אומרת שמשהו חסר או לא התאים. אדום אחיד לשתיהן היה מוחק את
 * ההבחנה בדיוק במקום שבו היא נדרשת.
 */
export function ReturnedNote({ info }: { info?: ReturnedInfo }) {
  if (!info) return null;
  const followUp = info.kind === 'follow_up';
  const Icon = followUp ? RotateCcw : MessageSquareWarning;
  return (
    <p
      className={`mt-1 flex items-start gap-1 rounded px-1.5 py-1 text-[11px] leading-snug ${
        followUp
          ? 'bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-300'
          : 'bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-300'
      }`}
    >
      <Icon className="mt-px h-3 w-3 flex-shrink-0" />
      <span className="min-w-0 whitespace-pre-wrap break-words">
        <span className="font-semibold">
          {followUp ? 'נדרש המשך טיפול' : returnedMeta(info)}
        </span>
        {followUp && <span className="opacity-70"> · {returnedMeta(info)}</span>}
        {info.note ? ` · ${info.note}` : <span className="opacity-70"> · לא נרשמה סיבה</span>}
      </span>
    </p>
  );
}
