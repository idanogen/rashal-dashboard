/**
 * דיווחי המכשירים: הטיפוס והנוסח לשורת הנהג. קובץ טהור בלי ייבוא, נבדק
 * ב-`test/driver-sync-report.test.mjs`. הקריאה למסד ב-`hooks/useDriverSyncReports.ts`.
 */
export interface DriverSyncReport {
  profile_id: string;
  driver_name: string | null;
  device: string | null;
  app_label: string | null;
  last_sync_at: string;
  pending: number;
  rejected: number;
  oldest_pending_at: string | null;
  online: boolean;
}

/** "דיווח לאחרונה 09:31 · 2 ממתינות · 📵" לשורת הנהג במסך הצוות. */
export function describeSyncReport(r: DriverSyncReport | undefined, now: Date = new Date()): { text: string; tone: 'ok' | 'warn' | 'bad' | 'none' } {
  if (!r) return { text: 'עוד לא דיווח', tone: 'none' };
  const ageMin = Math.round((now.getTime() - new Date(r.last_sync_at).getTime()) / 60_000);
  const when = ageMin < 2 ? 'עכשיו'
    : ageMin < 60 ? `לפני ${ageMin} דק׳`
    : ageMin < 1440 ? `לפני ${Math.round(ageMin / 60)} שע׳`
    : `לפני ${Math.round(ageMin / 1440)} ימים`;
  const parts = [`דיווח ${when}`];
  if (r.pending > 0) parts.push(`${r.pending} ממתינות`);
  if (r.rejected > 0) parts.push(`${r.rejected} נדחו`);
  if (!r.online) parts.push('📵 בלי קליטה');
  if (r.app_label) parts.push(`גרסה ${r.app_label}`);
  const stuck = r.pending > 0 && !!r.oldest_pending_at && now.getTime() - new Date(r.oldest_pending_at).getTime() > 2 * 3600_000 && ageMin < 30;
  const tone = stuck ? 'bad' : r.pending > 0 || ageMin > 120 ? 'warn' : 'ok';
  return { text: parts.join(' · '), tone };
}
