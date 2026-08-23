import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MessageCircle } from 'lucide-react';
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
        className={cn(
          'fixed bottom-5 z-40 flex h-14 w-14 items-center justify-center rounded-full',
          'bg-emerald-500 text-white shadow-lg transition-transform hover:scale-105 active:scale-95',
          // ימין קבוע ולא לוגי: הרובוט של ווידג'ט המשוב יושב בשמאל, ובעברית
          // `start` היה מציב את שניהם באותה פינה.
          'right-5',
        )}
      >
        <MessageCircle className="h-6 w-6" />
        {count > 0 && (
          <span className="absolute -top-1 -left-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-bold text-white ring-2 ring-white">
            {count}
          </span>
        )}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        {/* נפתח מאותו צד שבו יושב הכפתור, כדי שהתנועה תהיה מהמקום שנלחץ */}
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-3xl" dir="rtl">
          <SheetHeader className="border-b px-4 py-3">
            <SheetTitle className="flex items-center gap-2 text-base">
              <MessageCircle className="h-4 w-4 text-emerald-600" />
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
