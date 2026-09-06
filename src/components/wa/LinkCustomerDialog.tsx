import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, UserRound } from 'lucide-react';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { searchCustomers, customerSearchKey } from '@/lib/customer-card';
import { linkConversation, type LinkResult, type SuggestedCustomer } from '@/lib/wa-inbox';
import { cn } from '@/lib/utils';

/**
 * "שייך ללקוח": שיחה ממספר שאינו מוכר מקבלת לקוח.
 *
 * עידן, 06/09/2026, מהמשרד של ר.שעל: "יש לקוחות ששולחים לנו תמונות
 * לוואטסאפ אבל אין להם כרטיס לקוח... בוא נחשוב על המנגנון הכי נוח ופשוט
 * לשייך תמונות ממספרים שאנחנו לא מכירים ללקוחות קיימים."
 *
 * ⭐ אותו חיפוש של כרטיס הלקוח (שם, מספר לקוח, טלפון, מספר מסמך), ושתי
 * שאלות: מי זה (לא חובה) ולזכור את המספר (ברירת מחדל כן). אחרי השיוך
 * השיחה והתמונות עוברות ללקוח, והמספר נשמר לפעם הבאה.
 * 🔴 המערכת מציעה, העובד מחליט. אף פעם לא שיוך בלי לחיצה.
 */
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  phone: string | null;
  /** מה שהשרת הכין: ת.ז. מהתשובה, או טלפון של כמה לקוחות. */
  suggested?: SuggestedCustomer[] | null;
  /** לקוח שכבר נבחר בלחיצה על הצעה; מדלג על החיפוש. */
  preset?: SuggestedCustomer | null;
  onLinked: (r: LinkResult) => void;
}

export function LinkCustomerDialog({
  open, onOpenChange, conversationId, phone, suggested, preset, onLinked,
}: Props) {
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<SuggestedCustomer | null>(preset ?? null);
  const [label, setLabel] = useState('');
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) { setPicked(preset ?? null); setQ(''); setLabel(''); setRemember(true); }
  }, [open, preset]);

  const people = useQuery({
    queryKey: customerSearchKey(q),
    queryFn: () => searchCustomers(q),
    enabled: open && q.trim().length >= 2,
    staleTime: 30_000,
  });

  async function submit() {
    if (!picked || busy) return;
    setBusy(true);
    try {
      const r = await linkConversation({
        conversationId,
        customerNumber: picked.customer_number,
        label: label.trim() || null,
        remember,
      });
      toast.success(
        r.photos
          ? `שויך ל${r.customerName}. ${r.photos} תמונות עברו לכרטיס ויעלו לפריוריטי.`
          : `שויך ל${r.customerName}.`,
      );
      onLinked(r);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'השיוך נכשל');
    } finally {
      setBusy(false);
    }
  }

  const byLabel = (by?: string) =>
    by === 'id' ? 'לפי ת.ז. שנכתבה' : by === 'name' ? 'לפי השם שנכתב' : by === 'phone' ? 'הטלפון רשום אצלו' : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserRound className="h-4 w-4" />
            שייך את <bdi>{phone ?? 'המספר'}</bdi> ללקוח
          </DialogTitle>
        </DialogHeader>

        {!picked && (
          <div className="space-y-2">
            {suggested && suggested.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">נראה שזה:</div>
                {suggested.map((s) => (
                  <button
                    key={s.customer_number}
                    type="button"
                    onClick={() => setPicked(s)}
                    className="flex w-full items-center justify-between rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm hover:bg-emerald-100"
                  >
                    <span className="font-medium">{s.customer_name ?? 'לקוח'}{s.city ? ` · ${s.city}` : ''}</span>
                    <span className="text-xs text-muted-foreground"><bdi>{s.customer_number}</bdi> · {byLabel(s.by)}</span>
                  </button>
                ))}
              </div>
            )}
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="שם, מספר לקוח, טלפון או מספר מסמך"
            />
            <div className="max-h-56 space-y-1 overflow-y-auto">
              {people.isFetching && <div className="px-1 text-xs text-muted-foreground">מחפש…</div>}
              {q.trim().length >= 2 && !people.isFetching && (people.data ?? []).length === 0 && (
                <div className="px-1 text-xs text-muted-foreground">אין לקוח שמתאים לחיפוש.</div>
              )}
              {(people.data ?? []).filter((c) => Boolean(c.customer_number)).slice(0, 12).map((c) => (
                <button
                  key={c.customer_number}
                  type="button"
                  onClick={() => setPicked({ customer_number: String(c.customer_number), customer_name: c.customer_name, city: c.city })}
                  className="flex w-full items-center justify-between rounded-md border px-3 py-1.5 text-sm hover:bg-slate-50"
                >
                  <span>{c.customer_name}{c.city ? ` · ${c.city}` : ''}</span>
                  <bdi className="text-xs text-muted-foreground">{c.customer_number}</bdi>
                </button>
              ))}
            </div>
          </div>
        )}

        {picked && (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm">
              <span className="font-medium">{picked.customer_name ?? 'לקוח'}{picked.city ? ` · ${picked.city}` : ''}</span>
              <span className="flex items-center gap-2">
                <bdi className="text-xs text-muted-foreground">{picked.customer_number}</bdi>
                <button type="button" className="text-xs underline" onClick={() => setPicked(null)}>החלף</button>
              </span>
            </div>
            <div className="space-y-1">
              <Label htmlFor="link-label" className="text-xs">מי זה? (לא חובה)</Label>
              <Input id="link-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="הבת, מיכל" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
              לזכור את המספר ללקוח. מעכשיו הודעות ותמונות ממנו יזוהו כשלו, וההודעות האוטומטיות יישלחו גם אליו.
            </label>
          </div>
        )}

        <DialogFooter className={cn('gap-2', 'sm:justify-start')}>
          <Button onClick={submit} disabled={!picked || busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            שייך
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>ביטול</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
