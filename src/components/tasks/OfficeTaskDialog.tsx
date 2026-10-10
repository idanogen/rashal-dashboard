import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, Loader2, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useAllProfiles } from '@/hooks/useProfile';
import { searchCustomers, customerSearchKey } from '@/lib/customer-card';
import { nextWorkday, type OfficeTask, type OfficeTaskPriority } from '@/lib/office-tasks';
import type { NewOfficeTask } from '@/lib/office-tasks-api';

/** מי אפשר לשבץ: כל צוות המשרד הפעיל (לא נהגים, להם יש עצירות ביומן). */
const OFFICE_ROLES = new Set(['admin', 'management', 'team_manager', 'dispatcher', 'viewer']);

/**
 * ⭐ פתיחה ועריכה של משימת משרד (08/10/2026). ברירת המחדל ליעד: יום העבודה
 * הבא, כמו במשימת השטח. לקוח אופציונלי, דרך אותו חיפוש של כרטיס הלקוח.
 */
export function OfficeTaskDialog({
  open,
  onOpenChange,
  task,
  defaultAssigneeId,
  onSubmit,
  busy = false,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** עריכה של משימה קיימת. בלי: משימה חדשה. */
  task?: OfficeTask | null;
  defaultAssigneeId?: string | null;
  onSubmit: (input: NewOfficeTask) => void;
  busy?: boolean;
}) {
  const profiles = useAllProfiles();
  const people = useMemo(
    () => (profiles.data ?? []).filter((p) => !p.disabled && OFFICE_ROLES.has(p.role)).sort((a, b) => (a.fullName ?? a.username ?? '').localeCompare(b.fullName ?? b.username ?? '', 'he')),
    [profiles.data],
  );
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<OfficeTaskPriority>('normal');
  const [customerQ, setCustomerQ] = useState('');
  const [customer, setCustomer] = useState<{ number: string | null; name: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(task?.title ?? '');
    setDetails(task?.details ?? '');
    setAssigneeId(task?.assigneeId ?? defaultAssigneeId ?? '');
    setDueDate(task?.dueDate ?? nextWorkday(new Date()));
    setPriority(task?.priority ?? 'normal');
    setCustomer(task?.customerName ? { number: task.customerNumber, name: task.customerName } : null);
    setCustomerQ('');
  }, [open, task, defaultAssigneeId]);

  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(customerQ.trim()), 250);
    return () => clearTimeout(t);
  }, [customerQ]);
  const hits = useQuery({
    queryKey: customerSearchKey(debounced),
    queryFn: () => searchCustomers(debounced),
    enabled: open && debounced.length >= 2 && !customer,
    staleTime: 60 * 1000,
  });

  const assignee = people.find((p) => p.id === assigneeId);
  const valid = title.trim().length > 0 && !!assignee;

  const submit = () => {
    if (!valid || !assignee) return;
    onSubmit({
      title,
      details,
      assigneeId: assignee.id,
      assigneeName: assignee.fullName?.trim() || assignee.username || assignee.email,
      dueDate: dueDate || null,
      priority,
      customerNumber: customer?.number ?? null,
      customerName: customer?.name ?? null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="sm:max-w-lg">
        <DialogHeader className="text-start">
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" />
            {task ? 'עריכת משימה' : 'משימה חדשה'}
          </DialogTitle>
          <DialogDescription className="text-start">
            משימת משרד: מי שמשובץ עליה רואה אותה ב"משימות" וסוגר אותה בעצמו. ביקור אצל לקוח משבצים ביומן, לא כאן.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1">
            <Label htmlFor="ot-title">מה לעשות</Label>
            <Input id="ot-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="להתקשר ללקוח ולתאם החלפת מצבר" className="h-10 text-[16px] sm:text-sm" autoFocus />
          </div>
          <div className="grid gap-1 sm:grid-cols-2 sm:gap-3">
            <div className="grid gap-1">
              <Label htmlFor="ot-assignee">למי</Label>
              <select
                id="ot-assignee"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="h-10 rounded-md border border-input bg-white px-3 text-sm"
              >
                <option value="">בחר עובד</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>{p.fullName?.trim() || p.username || p.email}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-1">
              <Label htmlFor="ot-due">עד מתי</Label>
              <Input id="ot-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-10 text-[16px] sm:text-sm" />
            </div>
          </div>
          <div className="grid gap-1">
            <Label>לקוח (לא חובה)</Label>
            {customer ? (
              <div className="flex items-center justify-between rounded-md border bg-slate-50 px-3 py-2 text-sm">
                <span>
                  {customer.name}
                  {customer.number && <span className="ms-2 font-mono text-xs text-muted-foreground"><bdi>{customer.number}</bdi></span>}
                </span>
                <button type="button" className="text-xs text-blue-700 hover:underline" onClick={() => setCustomer(null)}>החלף</button>
              </div>
            ) : (
              <div className="relative">
                <Search className="pointer-events-none absolute inset-inline-start-2 top-3 h-4 w-4 text-muted-foreground" />
                <Input value={customerQ} onChange={(e) => setCustomerQ(e.target.value)} placeholder="שם, טלפון או מספר לקוח" className="h-10 ps-8 text-[16px] sm:text-sm" />
                {debounced.length >= 2 && (hits.data?.length ?? 0) > 0 && (
                  <ul className="absolute inset-inline-start-0 z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border bg-white shadow-md">
                    {hits.data!.slice(0, 8).map((h) => (
                      <li key={`${h.customer_number ?? ''}-${h.phone_local ?? ''}`}>
                        <button
                          type="button"
                          className="flex w-full items-center justify-between px-3 py-1.5 text-start text-sm hover:bg-slate-50"
                          onClick={() => setCustomer({ number: h.customer_number, name: h.customer_name ?? h.phone_local ?? '' })}
                        >
                          <span>{h.customer_name ?? 'ללא שם'}{h.city ? ` · ${h.city}` : ''}</span>
                          <bdi className="font-mono text-xs text-muted-foreground">{h.customer_number ?? h.phone_local}</bdi>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
          <div className="grid gap-1">
            <Label htmlFor="ot-details">פרטים</Label>
            <Textarea id="ot-details" value={details} onChange={(e) => setDetails(e.target.value)} rows={3} placeholder="מה בדיוק, מספרי מסמך, מה הלקוח ביקש" className="text-[16px] sm:text-sm" />
          </div>
          <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" className="accent-red-600" checked={priority === 'high'} onChange={(e) => setPriority(e.target.checked ? 'high' : 'normal')} />
            דחוף
          </label>
        </div>

        <DialogFooter className="gap-2 sm:justify-start">
          <Button onClick={submit} disabled={!valid || busy} className="gap-1.5">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {task ? 'שמור' : 'פתח משימה'}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>ביטול</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
