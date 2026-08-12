import { RefreshCw, Package, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
              <p className="text-xs text-muted-foreground">רשעל ציוד רפואי</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex items-center gap-1">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )
              }
            >
              דשבורד
            </NavLink>
            <NavLink
              to="/overview"
              className={({ isActive }) =>
                cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )
              }
            >
              דשבורד הנהלה
            </NavLink>
            <NavLink
              to="/dispatch"
              className={({ isActive }) =>
                cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )
              }
            >
              מסך סדרן
            </NavLink>
            <NavLink
              to="/inspections"
              className={({ isActive }) =>
                cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )
              }
            >
              בדיקות מנופים
            </NavLink>
            <NavLink
              to="/whatsapp"
              className={({ isActive }) =>
                cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )
              }
            >
              💬 וואטסאפ
            </NavLink>
            <NavLink
              to="/feedback"
              className={({ isActive }) =>
                cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )
              }
            >
              📝 הערות
            </NavLink>
            {isAdmin && (
              <NavLink
                to="/admin/users"
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-purple-50 text-purple-700'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  )
                }
              >
                👥 משתמשים
              </NavLink>
            )}
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
