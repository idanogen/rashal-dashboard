import { useMemo, useState } from 'react';
import { Sparkles, UserPlus } from 'lucide-react';

import { buildCustomerItems } from '@/components/dispatch/items';
import { UnscheduledPanel } from '@/components/dispatch/UnscheduledPanel';
import { Button } from '@/components/ui/button';
import type { NewCustomer } from '@/types/customer';
import { isBareCustomer } from '@/types/customer';

interface UnscheduledCustomersProps {
  customers: NewCustomer[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: (ids: string[]) => void;
  onClearSelection: () => void;
  onBulkSchedule: () => void;
  pendingScheduleIds: Set<string>;
  /**
   * מתג "רק ללא הזמנה". כשהוא מנוהל מבחוץ הדף יכול לספור אזורים על אותה
   * קבוצה בדיוק שמוצגת. בלי הפרופים האלה הרכיב מנהל אותו בעצמו.
   */
  onlyBare?: boolean;
  onOnlyBareChange?: (value: boolean) => void;
  /** חיפוש ואזורים משותפים למסך הסדרן. כשמועברים, הפאנל לא מצייר אותם בעצמו. */
  search?: string;
  selectedZones?: string[];
}

export function UnscheduledCustomers({
  customers,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onBulkSchedule,
  pendingScheduleIds,
  onlyBare: onlyBareProp,
  onOnlyBareChange,
  search,
  selectedZones,
}: UnscheduledCustomersProps) {
  /**
   * ברירת המחדל היא להציג רק לקוחות בלי שום רשומה נלווית. אלה האספקות
   * שאף מסך אחר לא מראה. מי שכבר יש לו הזמנה או קריאה נמצא ממילא בטאב שלו,
   * והצגתו כאן רק תכפיל אותו לסדרן.
   */
  const [localOnlyBare, setLocalOnlyBare] = useState(true);
  const onlyBare = onlyBareProp ?? localOnlyBare;
  const setOnlyBare = onOnlyBareChange ?? setLocalOnlyBare;

  const scoped = useMemo(
    () => (onlyBare ? customers.filter(isBareCustomer) : customers),
    [customers, onlyBare]
  );

  const bareCount = useMemo(() => customers.filter(isBareCustomer).length, [customers]);

  const items = useMemo(() => buildCustomerItems(scoped), [scoped]);

  return (
    <UnscheduledPanel
      items={items}
      title="לקוחות חדשים"
      Icon={UserPlus}
      accentBorder="border-s-violet-500"
      noun={{ one: 'אספקה', many: 'אספקות' }}
      emptyText="אין לקוחות חדשים ממתינים"
      searchPlaceholder="חיפוש: שם / מספר לקוח / טלפון / עיר"
      storageKey="customers"
      selectedIds={selectedIds}
      onToggleSelect={onToggleSelect}
      onSelectAll={onSelectAll}
      onClearSelection={onClearSelection}
      onBulkSchedule={onBulkSchedule}
      pendingScheduleIds={pendingScheduleIds}
      search={search}
      selectedZones={selectedZones}
      intro={
        // למה המסך הזה קיים — הסדרן לא ראה את הלקוחות האלה עד היום
        <div className="flex items-start gap-2 rounded-xl border border-violet-200 bg-violet-50/60 p-2.5 text-xs text-violet-900">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
          <span>
            לקוח חדש שנפתח בפריוריטי הוא ברוב המקרים אספקה שממתינה, גם כשעוד לא נפתחה לו הזמנה.
            כרגע יש <strong>{bareCount}</strong> לקוחות כאלה בלי שום רשומה נלווית.
          </span>
        </div>
      }
      toolbarExtra={
        <Button
          variant={onlyBare ? 'default' : 'outline'}
          size="sm"
          className="h-7 text-xs"
          onClick={() => setOnlyBare(!onlyBare)}
        >
          {onlyBare ? 'רק ללא הזמנה' : 'כל הלקוחות החדשים'}
        </Button>
      }
    />
  );
}
