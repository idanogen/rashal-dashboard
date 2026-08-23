import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { WaGlyph } from '@/components/wa/WaGlyph';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { InboxBoard, HEIGHT_DOCK } from '@/components/wa/InboxBoard';
import { fetchInbox } from '@/lib/wa-inbox';
import { useCurrentProfile } from '@/hooks/useProfile';
import { screenAllow } from '@/lib/screen-access';
import { cn } from '@/lib/utils';

/**
 * כפתור צף שפותח את תיבת השיחות מכל מסך.
 *
 * ⭐ **הרעיון: לא לעזוב את המסך שעובדים עליו.** הסדרן באמצע שיבוץ, הלקוח
 * שואל משהו, והתשובה נמצאת שתי לחיצות משם ובלי לאבד את מה שפתוח.
 *
 * 🔴 **הכפתור יושב בקצה הימני התחתון בכוונה.** ווידג'ט המשוב של עוגן
 * (הרובוט הצף) יושב בקצה השמאלי, ושני עיגולים באותה פינה מכסים זה את זה.
 *
 * 🔴 **והגישה נגזרת מאותה מפה של המסכים.** כפתור שנפתח למי שאין לו
 * הרשאה היה מציג רשימה ריקה או שגיאה, ושניהם נראים כמו תקלה.
 */
const POLL_MS = 60_000;

export function WaDock() {
  const [open, setOpen] = useState(false);
  const { data: profile } = useCurrentProfile();
  const allowed = !!profile && !profile.disabled && screenAllow('/inbox').includes(profile.role);

  const waiting = useQuery({
    queryKey: ['wa-inbox-waiting-badge'],
    queryFn: () => fetchInbox('waiting', ''),
    refetchInterval: POLL_MS,
    enabled: allowed,
    retry: false,
  });

  if (!allowed) return null;

  // 🔴 שרשרת מלאה. תשובה חלקית לא תפיל את כל המסך בגלל תג על כפתור.
  const count = waiting.data?.counts?.waiting ?? 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={count > 0 ? `${count} לקוחות מחכים לתשובה` : 'תיבת השיחות'}
        aria-label="תיבת השיחות"
        // ⭐ אותו עיצוב בדיוק כמו הבועה שבחלונית בתוך פריוריטי: אותו
        // גודל, אותו מדרג צבע, אותו צל, ואותה הרמה קלה במעבר עכבר.
        style={{
          background: 'linear-gradient(160deg, #22c55e, #15903f)',
          boxShadow: '0 8px 24px rgba(21,144,63,.40), inset 0 1px 0 rgba(255,255,255,.35)',
        }}
        className={cn(
          'group fixed bottom-5 z-40 flex h-[54px] w-[54px] items-center justify-center rounded-full',
          'text-white transition-transform duration-150 hover:-translate-y-0.5 active:scale-95',
          // ימין קבוע ולא לוגי: הרובוט של ווידג'ט המשוב יושב בשמאל, ובעברית
          // `start` היה מציב את שניהם באותה פינה.
          'right-5',
        )}
      >
        <WaGlyph className="h-[27px] w-[27px]" />
        {count > 0 && (
          <span
            className="absolute -top-1 -left-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-red-600 px-1.5 text-[11px] font-bold leading-none text-white"
            style={{ boxShadow: '0 2px 6px rgba(220,38,38,.35)' }}
          >
            {count}
          </span>
        )}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        {/* נפתח מאותו צד שבו יושב הכפתור, כדי שהתנועה תהיה מהמקום שנלחץ */}
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-3xl" dir="rtl">
          <SheetHeader className="border-b px-4 py-3">
            <SheetTitle className="flex items-center gap-2 text-base">
              <WaGlyph className="h-4 w-4 text-emerald-600" />
              תיבת השיחות
              {count > 0 && (
                <span className="rounded-full bg-red-100 px-2 text-xs font-semibold text-red-700">
                  {count} מחכים
                </span>
              )}
            </SheetTitle>
          </SheetHeader>
          <div className="overflow-hidden p-3">
            {/* נטען רק כשנפתח, כדי שהסקר לא ירוץ ברקע בכל מסך */}
            {open && <InboxBoard heightClass={HEIGHT_DOCK} />}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
