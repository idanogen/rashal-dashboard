import { AlertTriangle } from 'lucide-react';
import { officeAlertNote } from '@/lib/stop-note-alert';

/**
 * הערת המשרד לעצירה, בולטת באדום (עמי ושלומי, 11/11/2026). במשימה (שם זה
 * תיאור המשימה) שורה רגילה אם נתנו `plainClassName`, אחרת כלום. מקבילה באפליקציה:
 * `rashal-driver/src/components/StopNoteAlert.tsx`.
 */
export function StopNoteAlert({ stop, plainClassName }: {
  stop: { sourceType?: string | null; notes?: string | null };
  /** כשנותנים: הערה שאינה התראה (תיאור משימה) מוצגת כשורה רגילה במחלקה הזו. */
  plainClassName?: string;
}) {
  const note = officeAlertNote(stop);
  if (!note) return plainClassName && stop.notes ? <div className={plainClassName}>📝 {stop.notes}</div> : null;
  return (
    <div className="rounded-lg border-2 border-red-500 bg-red-50 px-3 py-2 text-start">
      <div className="flex items-center gap-1.5 text-xs font-extrabold text-red-700">
        <AlertTriangle className="h-3.5 w-3.5" />
        הערה חשובה מהמשרד
      </div>
      <p className="mt-0.5 whitespace-pre-line text-sm font-bold text-red-900">{note}</p>
    </div>
  );
}
