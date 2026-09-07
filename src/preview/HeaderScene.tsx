import { useEffect } from 'react';
import { AppHeader } from '@/components/layout/AppHeader';
import { seedFreshnessForPreview } from '@/lib/sync-freshness';

/**
 * ?view=header: חיווי הסנכרון בכותרת (07/09/2026) בשני מצבים, בלי להתחבר.
 * `?stale=1` מצלם את המצב הכתום: משיכה ישנה בשעות העבודה, או ערוץ שנפל.
 */
export function HeaderScene() {
  const stale = new URLSearchParams(location.search).get('stale') === '1';
  useEffect(() => {
    seedFreshnessForPreview({
      pullAt: new Date(Date.now() - (stale ? 47 : 4) * 60_000).toISOString(),
      pullStatus: 'success',
      probedAt: Date.now(),
      channel: stale ? 'down' : 'live',
      pulling: false,
      error: null,
    });
  }, [stale]);
  return (
    <div dir="rtl" className="min-h-[220px] bg-slate-50">
      <AppHeader />
      <div className="mx-auto max-w-7xl px-6 py-4 text-sm text-slate-500">
        {stale
          ? 'מצב כתום: המשיכה האחרונה לפני 47 דקות בשעות העבודה, והערוץ החי נפל.'
          : 'מצב רגיל: המשיכה האחרונה לפני 4 דקות, הערוץ החי מחובר.'}
      </div>
    </div>
  );
}
