import { RefreshCw, LogOut, Settings, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { useCurrentProfile } from '@/hooks/useProfile';
import { BrandMark } from '@/components/BrandMark';
import { screenAllow } from '@/lib/screen-access';
import { ROLE_LABELS } from '@/types/profile';

// שאילתות הנתונים שהכותרת מדווחת עליהן.
const TRACKED_KEYS = new Set([
  'orders',
  'serviceCalls',
  'pickups',
  'calendarStops',
  'newCustomers',
]);

/**
 * הקישורים בתפריט.
 *
 * 🔴 **הרשימה מסוננת לפי אותה מפה שהנתב עצמו קורא ממנה** (`screen-access`).
 * קישור שמוביל למסך חסום הוא בדיוק אותה תקלה שחוזרת כאן: מסך שמבטיח
 * פעולה שלא תקרה. עד 23/08/2026 "דשבורד הנהלה" הופיע לכולם, וכשהוא
 * הוגבל למנהל מערכת הוא היה מוביל את השאר למסך "אין הרשאת גישה".
 */
const PRIMARY_LINKS = [
  { to: '/dispatch', label: 'מסך סדרן' },
  { to: '/orders', label: 'דשבורד' },
  { to: '/inbox', label: '💬 שיחות' },
  // ⭐ נקודת הכניסה כשלקוח מתקשר, ולכן היא בשורה הראשית ולא בתפריט הניהול.
  { to: '/customer', label: '🪪 כרטיס לקוח' },
];

const ADMIN_LINKS = [
  { to: '/overview', label: 'דשבורד הנהלה' },
  // ⭐ בתפריט הניהול ולא בשורה הראשית: זה מסך שקוראים בו פעם ביום, לא
  // מסך שעובדים בו. 🔴 והוא פתוח למנהל צוות ולסדרן, בניגוד לדשבורד
  // ההנהלה שלצידו, כי שביעות רצון אינה כסף. הסינון עצמו נעשה בהמשך
  // הקובץ מול `screenAllow`, ולכן מי שאינו מורשה פשוט לא יראה אותו.
  { to: '/surveys', label: '⭐ סקרי שביעות רצון' },
  { to: '/performance', label: '📊 ביצועי הצוות' },
  { to: '/collections', label: '💰 גיול חובות' },
  { to: '/inspections', label: 'בדיקות מנופים' },
  { to: '/whatsapp', label: 'וואטסאפ' },
  { to: '/admin/wa-templates', label: '💬 תבניות וואטסאפ' },
  { to: '/admin/wa-automations', label: '🤖 אוטומציות וואטסאפ' },
  { to: '/admin/users', label: '👥 משתמשים' },
  { to: '/admin/team', label: '🚚 צוות השטח' },
  { to: '/admin/permissions', label: '🛡️ הרשאות' },
];

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
    isActive
      ? 'bg-primary/10 text-primary'
      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
  );

/** ניסוח עברי תקין. "לפני 1 דקות" ו-"לפני 2822 דקות" שניהם לא תקינים. */
function formatAgo(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'עכשיו';
  if (minutes === 1) return 'לפני דקה';
  if (minutes === 2) return 'לפני שתי דקות';
  if (minutes < 60) return `לפני ${minutes} דקות`;
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return 'לפני שעה';
  if (hours === 2) return 'לפני שעתיים';
  if (hours < 24) return `לפני ${hours} שעות`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'לפני יום';
  if (days === 2) return 'לפני יומיים';
  return `לפני ${days} ימים`;
}

/** האות הראשונה לעיגול. מדלגת על תווים שאינם אות, כדי ש-"ר.שעל" לא ייתן נקודה. */
function userInitial(name?: string): string {
  const m = (name ?? '').match(/[\p{L}\p{N}]/u);
  return m ? m[0].toUpperCase() : '?';
}

export function AppHeader() {
  const queryClient = useQueryClient();
  const { signOut } = useAuth();
  const { data: profile } = useCurrentProfile();
  const role = profile?.role;
  const canSee = (to: string) => !!role && screenAllow(to).includes(role);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // 🔴 עד כה נמדד הזמן שעבר מאז שהטאב נפתח, וזה נקרא "עודכן". טאב שנשאר
  // פתוח לילה שלם הציג "עודכן לפני 2822 דקות" בזמן שהנתונים היו טריים.
  // מודדים עכשיו את המשיכה האחרונה שבאמת הצליחה מול Supabase.
  const [lastUpdated, setLastUpdated] = useState<number>(() => Date.now());
  const [timeAgo, setTimeAgo] = useState('עכשיו');

  useEffect(() => {
    const cache = queryClient.getQueryCache();
    const readLatestFetch = () => {
      let latest = 0;
      for (const query of cache.getAll()) {
        const root = query.queryKey[0];
        if (typeof root !== 'string' || !TRACKED_KEYS.has(root)) continue;
        if (query.state.dataUpdatedAt > latest) latest = query.state.dataUpdatedAt;
      }
      // רק קדימה, כדי שמשיכה שנכשלה לא תחזיר את השעון אחורה.
      if (latest > 0) setLastUpdated((prev) => (latest > prev ? latest : prev));
    };
    readLatestFetch();
    return cache.subscribe(readLatestFetch);
  }, [queryClient]);

  useEffect(() => {
    const tick = () => setTimeAgo(formatAgo(Date.now() - lastUpdated));
    tick();
    const interval = setInterval(tick, 15_000);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  // מעל שעה בלי משיכה מוצלחת — שווה לרענן.
  const isStale = Date.now() - lastUpdated > 60 * 60_000;

  // הגובה האמיתי של הכותרת נמסר כמשתנה CSS, כדי שאלמנטים דביקים אחרים
  // (שורת המתגים במסך הסדרן) ייצמדו בדיוק מתחתיה. הגובה משתנה בין מובייל
  // לדסקטופ, ומספר קשיח היה משאיר סדק שתוכן נגלל מאחוריו.
  const headerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const publish = () =>
      document.documentElement.style.setProperty(
        '--app-header-h',
        `${el.offsetHeight}px`
      );
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  async function handleRefresh() {
    setIsRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['orders'] }),
      queryClient.invalidateQueries({ queryKey: ['serviceCalls'] }),
      queryClient.invalidateQueries({ queryKey: ['pickups'] }),
      queryClient.invalidateQueries({ queryKey: ['calendarStops'] }),
      queryClient.invalidateQueries({ queryKey: ['newCustomers'] }),
    ]);
    setLastUpdated(Date.now());
    setTimeAgo('עכשיו');
    setTimeout(() => setIsRefreshing(false), 600);
  }

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-sm"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <BrandMark className="h-9 w-9" />
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold leading-tight">דשבורד הזמנות</h1>
              <p className="text-xs text-muted-foreground">ר.שעל ציוד רפואי</p>
            </div>
          </div>

          {/* Navigation
              שורה ראשונה: מה שעושים כל יום. מה שמגדירים פעם בכמה שבועות
              (דשבורד הנהלה, בדיקות מנופים, וואטסאפ, משתמשים) עבר לתפריט "ניהול",
              אחרי שבדיקה הראתה שהתפריט משרת בפועל סדרן אחד. */}
          <nav className="flex items-center gap-1">
            {PRIMARY_LINKS.filter((l) => canSee(l.to)).map((link) => (
              <NavLink key={link.to} to={link.to} className={navLinkClass}>
                {link.label}
              </NavLink>
            ))}

            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground data-[state=open]:bg-muted/50">
                <Settings className="h-4 w-4" />
                ניהול
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  ניהול והגדרות
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {ADMIN_LINKS.filter((l) => canSee(l.to)).map((link) => (
                  <DropdownMenuItem key={link.to} asChild>
                    <NavLink to={link.to} className="cursor-pointer">
                      {link.label}
                    </NavLink>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {/* מי מחובר. 🔴 עד 23/08/2026 לא הופיע כאן שום שם, ולכן במחשב
              משותף אי אפשר היה לדעת בשם מי נרשמת הפעולה. */}
          {profile && (
            <div className="hidden items-center gap-2 md:flex">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary"
                aria-hidden
              >
                {userInitial(profile.fullName ?? profile.username)}
              </div>
              <div className="leading-tight">
                <p className="text-xs font-semibold">
                  {profile.fullName || profile.username || 'משתמש'}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {ROLE_LABELS[profile.role] ?? profile.role}
                </p>
              </div>
            </div>
          )}
          <span
            className={cn(
              'hidden text-xs sm:block',
              isStale ? 'font-medium text-amber-600' : 'text-muted-foreground'
            )}
            title="הזמן שעבר מאז המשיכה האחרונה של הנתונים מהשרת. שינויים מגיעים גם בזמן אמת, וכפתור הרענון מושך הכל מחדש."
          >
            עודכן {timeAgo}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">רענון</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => signOut()}
            title={profile ? `התנתקות מהחשבון של ${profile.fullName || profile.username}` : 'התנתק'}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
