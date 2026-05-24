import type { ReactNode } from 'react';
import { Package, LogOut, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';

interface DriverShellProps {
  children: ReactNode;
}

/**
 * Minimal layout for the driver view — single page, no admin nav.
 * Just brand mark, refresh, and sign-out.
 */
export function DriverShell({ children }: DriverShellProps) {
  useRealtimeSync();
  const { signOut } = useAuth();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['calendarStops'] }),
      qc.invalidateQueries({ queryKey: ['orders'] }),
      qc.invalidateQueries({ queryKey: ['serviceCalls'] }),
    ]);
    setTimeout(() => setRefreshing(false), 500);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-card/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500 text-white">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold leading-tight">ראש"ל ציוד רפואי</h1>
              <p className="text-[10px] text-muted-foreground">מסלול הנהג</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => signOut()} title="התנתק">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-4">{children}</main>
    </div>
  );
}
