import { useState } from 'react';
import { toast } from 'sonner';
import { useUpdateStopCoordination } from '@/hooks/useUpdateStopCoordination';

/**
 * הערת המשרד בדיאלוג התיאום (11/11/2026, עמי ושלומי). נשמרת ב-`calendar_stops.notes`
 * ומוצגת לטכנאי באדום בכרטיס הביקור ובפרטי הקריאה (`StopNoteAlert`).
 *
 * 🔴 השדה נפתח עם ההערה הקיימת. עד 11/11 הוא נפתח ריק, וכל תיאום בלי הערה
 * כתב `notes: undefined`, ש-`updateStop` הופך ל-null: ההערה הקודמת נמחקה.
 * 🔴 "אני רושם הערה וסוגר, וזה לא נשמר": הערה שהשתנתה נשמרת גם בסגירה.
 */
export function useCoordinationNote(stop: { stopId: string; notes?: string } | null) {
  const update = useUpdateStopCoordination();
  const [note, setNote] = useState('');
  const dirty = !!stop && note.trim() !== (stop.notes ?? '').trim();

  /** מה שנכתב לעמודה: ריק מוחק, כי השדה נפתח מלא ומי שרוקן אותו התכוון. */
  const value = note.trim() || undefined;

  /** שומר את ההערה בלבד. מחזיר false בכישלון; ה-hook כבר הציג את השגיאה. */
  async function save(): Promise<boolean> {
    if (!stop || !dirty) return true;
    try {
      await update.mutateAsync({ stopId: stop.stopId, silent: true, fields: { notes: value } });
    } catch {
      return false;
    }
    toast.success(value ? 'ההערה נשמרה, הטכנאי יראה אותה באדום' : 'ההערה נמחקה');
    return true;
  }

  return { note, setNote, dirty, value, save, saving: update.isPending };
}
