import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** חישוב מספר ימים מאז תאריך יצירת ההזמנה */
export function getDaysSinceCreated(created: string | undefined): number | null {
  if (!created) return null;
  const createdDate = new Date(created);
  if (isNaN(createdDate.getTime())) return null;
  const now = new Date();
  const diffMs = now.getTime() - createdDate.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/** צבע לפי מספר ימים: ירוק (0-3), כתום (4-7), אדום (8+) */
export function getDaysColor(days: number | null): string {
  if (days === null) return 'text-muted-foreground';
  if (days <= 3) return 'text-green-600';
  if (days <= 7) return 'text-amber-600';
  return 'text-red-600';
}
