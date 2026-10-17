import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Phone, Send, UserPlus } from 'lucide-react';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAddCustomerContact, useCustomerPhoneBook } from '@/hooks/useCustomerPhoneBook';
import { searchCustomers, customerSearchKey } from '@/lib/customer-card';
import {
  addErrorLine, addResultLine, buildPhoneBook, formatMobile, isLinkedNumber, normalizeMobile,
} from '@/lib/contact-phone';

/**
 * ⭐ "שלח למספר אחר" מתוך התיבה (עידן, 13/10/2026).
 *
 * הבקשה: "נחפש בממשק שלנו את הלקוח, ושם יהיה אפשרות לשלוח למספר אחר. נוסיף את
 * המספר, נבחר את התבנית ונשלח. בסוף תהיה אפשרות להוסיף את האיש קשר למערכת,
 * וזה יוסף גם אצלנו וגם לפריוריטי". זה המסלול שכבר קיים בתוסף שבתוך פריוריטי,
 * עכשיו גם בדשבורד.
 *
 * שלושה צעדים, ורק הראשון והשלישי חדשים:
 *   1. `OtherNumberDialog`: בוחרים מספר מספר הטלפונים של הלקוח או מקלידים חדש.
 *   2. חלון התבניות הקיים (`TemplateSendDialog`), על המספר הזה.
 *   3. `SaveContactPrompt`: רק אם המספר עוד לא מקושר, "להוסיף לאנשי הקשר?".
 *      ההוספה עוברת ב-`customer_add_contact`, כמו בספר הטלפונים, ומשם
 *      `rashal-push` כותב אותו לפריוריטי (CUSTPERSONNEL) בריצה הבאה.
 */

export interface OtherNumberCustomer {
  number: string;
  name: string;
  /** הטלפון שבכרטיס. undefined = לא ידוע כאן, נשלף מהחיפוש. */
  mainPhone?: string | null;
}

/** הטלפון הראשי של הלקוח, מהחיפוש כשהמסך שפתח את החלון לא מכיר אותו. */
function useMainPhone(customer: OtherNumberCustomer | null, enabled: boolean) {
  const needs = enabled && !!customer && customer.mainPhone === undefined;
  const hits = useQuery({
    queryKey: customerSearchKey(customer?.number ?? ''),
    queryFn: () => searchCustomers(customer!.number),
    enabled: needs,
    staleTime: 60_000,
  });
  if (!customer) return { phone: null, loading: false };
  if (customer.mainPhone !== undefined) return { phone: customer.mainPhone, loading: false };
  const hit = (hits.data ?? []).find((h) => h.customer_number === customer.number);
  return { phone: hit?.phone_local ?? hit?.phone ?? null, loading: hits.isLoading };
}

export function OtherNumberDialog({
  open, onOpenChange, customer, onContinue,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  customer: OtherNumberCustomer | null;
  /** המספר שנבחר (05XXXXXXXX), והאם הוא כבר מוכר ללקוח. */
  onContinue: (phone: string, known: boolean, mainPhone: string | null) => void;
}) {
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const main = useMainPhone(customer, open);
  const book = useCustomerPhoneBook(customer?.number, open);
  const entries = buildPhoneBook(main.phone, book.data ?? []);
  const pickable = entries.filter((e) => /^05\d{8}$/.test(e.phone));

  useEffect(() => {
    if (open) { setTyped(''); setError(null); }
  }, [open]);

  const go = (raw: string) => {
    const phone = normalizeMobile(raw);
    if (!phone) {
      setError('זה לא מספר נייד ישראלי (05X). הודעות וואטסאפ יוצאות רק לנייד.');
      return;
    }
    onContinue(phone, isLinkedNumber(entries, phone), main.phone);
  };

  const KIND_TEXT = { main: 'ראשי', linked: 'מקושר', priority: 'מפריוריטי' } as const;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="pe-6 leading-snug">שליחה למספר אחר{customer?.name ? ` של ${customer.name}` : ''}</DialogTitle>
        </DialogHeader>

        {/* 🔴 min-w-0: פריט בתוך ה-grid של הדיאלוג מתרחב לרוחב התוכן, והשורות גלשו מהחלון ב-390. */}
        <div className="min-w-0 space-y-3">
          <div>
            <div className="mb-1 text-[12px] font-semibold text-slate-700">מספרים שמוכרים ללקוח</div>
            {book.isLoading || main.loading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> טוען…
              </div>
            ) : book.error ? (
              <p className="text-xs text-red-700">לא הצלחנו לטעון את הטלפונים של הלקוח. אפשר להקליד מספר למטה.</p>
            ) : pickable.length === 0 ? (
              <p className="text-xs text-muted-foreground">אין ללקוח נייד רשום. הקלידו מספר למטה.</p>
            ) : (
              <ul className="space-y-1" data-testid="other-number-picks">
                {pickable.map((e) => (
                  <li key={`${e.kind}-${e.phone}`}>
                    <button
                      type="button"
                      onClick={() => go(e.phone)}
                      className="flex w-full items-center gap-2 rounded-lg border bg-white px-2.5 py-1.5 text-start text-[13px] hover:border-blue-300 hover:bg-blue-50"
                    >
                      <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <bdi dir="ltr" className="shrink-0 whitespace-nowrap font-mono font-semibold text-slate-900">{formatMobile(e.phone)}</bdi>
                      <span className="shrink-0 whitespace-nowrap rounded bg-slate-100 px-1.5 text-[10.5px] text-slate-600">{KIND_TEXT[e.kind]}</span>
                      {e.label && <span className="min-w-0 truncate text-slate-600">{e.label}</span>}
                      <Send className="ms-auto h-3.5 w-3.5 shrink-0 text-blue-600" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); go(typed); }}
            className="rounded-lg border bg-slate-50/70 p-2.5"
          >
            <label htmlFor="other-number-input" className="mb-1 block text-[12px] font-semibold text-slate-700">
              מספר חדש
            </label>
            <div className="flex gap-1.5">
              <Input
                id="other-number-input"
                value={typed}
                onChange={(e) => { setTyped(e.target.value); setError(null); }}
                inputMode="tel"
                dir="ltr"
                autoFocus
                placeholder="05X-XXXXXXX"
                className="h-9 min-w-0 flex-1 bg-white text-[16px] sm:text-sm"
              />
              <Button type="submit" size="sm" className="h-9" disabled={!typed.trim()}>
                המשך לתבנית
              </Button>
            </div>
            {error && <p className="mt-1 text-[12px] text-red-700" role="alert">{error}</p>}
            <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
              למספר שלא כתב לנו ב-24 השעות האחרונות אפשר לשלוח רק תבנית מאושרת. אחרי השליחה נשאל אם
              להוסיף את המספר לאנשי הקשר של הלקוח.
            </p>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SaveContactPrompt({
  open, onOpenChange, customer, phone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  customer: OtherNumberCustomer | null;
  phone: string | null;
}) {
  const add = useAddCustomerContact(customer?.number);
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) { setLabel(''); setError(null); }
  }, [open]);

  const save = () => {
    if (!phone) return;
    setError(null);
    add.mutate(
      { phone, label: label || null },
      {
        onSuccess: (r) => {
          toast.success(addResultLine(r.result, r.phone_local));
          onOpenChange(false);
        },
        onError: (err) => setError(addErrorLine(err instanceof Error ? err.message : String(err))),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="pe-6 leading-snug">להוסיף את המספר לאנשי הקשר?</DialogTitle>
        </DialogHeader>
        <div className="min-w-0 space-y-2.5 text-[13px] text-slate-700">
          <p>
            ההודעה יצאה ל-<bdi dir="ltr" className="font-mono font-semibold">{phone ? formatMobile(phone) : ''}</bdi>.
            {' '}להוסיף אותו כאיש קשר של <b>{customer?.name || customer?.number}</b>?
          </p>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="מי זה (הבת, מיכל)"
            aria-label="מי זה"
            className="h-9 bg-white text-[16px] sm:text-sm"
          />
          <p className="text-[11.5px] leading-snug text-muted-foreground">
            המספר יישמר אצלנו מיד, וייכתב לפריוריטי כאיש קשר בכרטיס הלקוח בתוך רבע שעה. השיחות ממנו
            יזוהו כשל הלקוח, והוא יקבל גם את ההודעות האוטומטיות. אפשר לכבות את זה במתג בספר הטלפונים.
          </p>
          {error && <p className="text-[12px] text-red-700" role="alert">{error}</p>}
        </div>
        <DialogFooter className="gap-2 sm:justify-start">
          <Button onClick={save} disabled={add.isPending || !phone} className="gap-1">
            {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            הוסף לאנשי הקשר
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={add.isPending}>
            לא עכשיו
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
