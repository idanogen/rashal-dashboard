import type { ReactNode } from 'react';
import { AppHeader } from './AppHeader';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { WaDock } from '@/components/wa/WaDock';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  useRealtimeSync();
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {children}
      </main>
      {/* תיבת השיחות זמינה מכל מסך, בלי לעזוב את מה שפתוח */}
      <WaDock />
    </div>
  );
}
