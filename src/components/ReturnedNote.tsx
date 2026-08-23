import { MessageSquareWarning } from 'lucide-react';
import { returnedMeta, type ReturnedInfo } from '@/lib/returned-from-route';

/**
 * הסיבה שהנהג רשם כשסימן "לא בוצע".
 *
 * ⭐ יושב בכל מקום שבו מופיע החיווי "חזר מהקו", כי חיווי בלי סיבה מחזיר את
 * המנהל לטלפן לנהג ולשאול "למה", וזה בדיוק מה שהדיווח נועד לחסוך.
 */
export function ReturnedNote({ info }: { info?: ReturnedInfo }) {
  if (!info) return null;
  return (
    <p className="mt-1 flex items-start gap-1 rounded bg-red-50 px-1.5 py-1 text-[11px] leading-snug text-red-800 dark:bg-red-950/30 dark:text-red-300">
      <MessageSquareWarning className="mt-px h-3 w-3 flex-shrink-0" />
      <span className="min-w-0 whitespace-pre-wrap break-words">
        <span className="font-semibold">{returnedMeta(info)}</span>
        {info.note ? ` · ${info.note}` : <span className="opacity-70"> · לא נרשמה סיבה</span>}
      </span>
    </p>
  );
}
