import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const TONE_PILL: Record<'amber' | 'violet' | 'red' | 'green' | 'slate' | 'blue', string> = {
  amber: 'border-amber-200 bg-amber-50 text-amber-800',
  violet: 'border-violet-200 bg-violet-50 text-violet-700',
  red: 'border-red-200 bg-red-50 text-red-700',
  green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  slate: 'border-slate-200 bg-slate-100 text-slate-700',
  blue: 'border-blue-200 bg-blue-50 text-blue-700',
};

export function Pill({ tone, children, title }: { tone: keyof typeof TONE_PILL; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={cn('inline-flex h-5 shrink-0 items-center rounded-full border px-2 text-[11px] font-semibold', TONE_PILL[tone])}>
      {children}
    </span>
  );
}

