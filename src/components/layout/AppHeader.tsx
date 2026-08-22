import { RefreshCw, Package, LogOut, Settings, ChevronDown } from 'lucide-react';
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
import { useIsAdmin } from '@/hooks/useProfile';

// שאילתות הנתונים שהכותרת מדווחת עליהן.
const TRACKED_KEYS = new Set([
  'orders',
  'serviceCalls',
  'pickups',
  'calendarStops',
  'newCustomers',
]);

/** מה שעושים כל יום. הסדר הוא סדר החשיבות, לא סדר הבנייה. */
const PRIMARY_LINKS = [
  { to: '/dispatch', label: 'מסך סדרן' },
  { to: '/orders', label: 'דשבורד' },
  { to: '/inbox', label: '💬 שיחות' },
  { to: '/feedback', label: '📝 הערות' },
];

/** מה שנוגעים בו פעם בכמה שבועות. יושב בתפריט "ניהול". */
const ADMIN_LINKS = [
  { to: '/overview', label: 'דשבורד הנהלה' },
  { to: '/inspections', label: 'בדיקות מנופים' },
  { to: '/whatsapp', label: 'וואטסאפ' },
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

export function AppHeader() {
  const queryClient = useQueryClient();
  const { signOut } = useAuth();
  const isAdmin = useIsAdmin();
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
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Package className="h-5 w-5" />
            </div>
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
            {PRIMARY_LINKS.map((link) => (
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
                {ADMIN_LINKS.map((link) => (
                  <DropdownMenuItem key={link.to} asChild>
                    <NavLink to={link.to} className="cursor-pointer">
                      {link.label}
                    </NavLink>
                  </DropdownMenuItem>
                ))}
                {isAdmin && (
                  <DropdownMenuItem asChild>
                    <NavLink to="/admin/wa-templates" className="cursor-pointer">
                      💬 תבניות וואטסאפ
                    </NavLink>
                  </DropdownMenuItem>
                )}
                {isAdmin && (
                  <DropdownMenuItem asChild>
                    <NavLink to="/admin/users" className="cursor-pointer">
                      👥 משתמשים
                    </NavLink>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>
        </div>

        <div className="flex items-center gap-3">
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
          <Button variant="ghost" size="sm" onClick={() => signOut()} title="התנתק">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
