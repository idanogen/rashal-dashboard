import { Truck } from 'lucide-react';
import { matchLabel, type OpenItem } from '@/lib/customer-answer';

/** חלקים משותפים לכרטיס הלקוח ולקבצים שפוצלו ממנו (24/11/2026). */

export function MatchTag({ kind }: { kind: OpenItem['match'] }) {
  const label = matchLabel(kind);
  if (!label) return null;
  return (
    <span
      className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500"
      title="הרשומה חוברה ללקוח בלי מספר לקוח, ולכן זו התאמה ולא ודאות"
    >
      {label}
    </span>
  );
}

export function Section({
  title, icon: Icon, count, children,
}: { title: string; icon: typeof Truck; count?: number; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-white p-3">
      <div className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-slate-800">
        <Icon className="h-4 w-4 text-slate-500" />
        {title}
        {count != null && <span className="text-xs font-medium text-muted-foreground">({count})</span>}
      </div>
      {children}
    </div>
  );
}
