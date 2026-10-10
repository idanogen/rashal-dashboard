import { useState } from 'react';
import { Loader2, Phone, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAddCustomerContact, useCustomerPhoneBook } from '@/hooks/useCustomerPhoneBook';
import {
  addErrorLine, addResultLine, buildPhoneBook, formatMobile, normalizeMobile, type PhoneBookEntry,
} from '@/lib/contact-phone';

/**
 * ⭐ ספר הטלפונים של הלקוח, עם דלת ידנית (עמי, 06-07/10/2026).
 *
 * שלוש שכבות: הטלפון הראשי (מפריוריטי, לא עורכים כאן), מספרים שקישרנו
 * (`customer_contacts`: יעד להודעות האוטומטיות ונכתבים לפריוריטי כאיש קשר),
 * ואנשי הקשר שמסונכרנים מפריוריטי (לזיהוי נכנס בלבד). ההוספה עוברת דרך
 * `customer_add_contact`, אותו שומר שמגן על תמונות הוואטסאפ: משרד תמיד,
 * טכנאי רק על לקוח שבסידור שלו.
 *
 * 🔴 המסך אומר במילים שמספר "חדש" לא מחליף את הטלפון בכרטיס הלקוח
 * בפריוריטי. אנחנו לא כותבים לכרטיס הלקוח, רק לאנשי הקשר שלו.
 */
export function CustomerPhoneBook({
  customerNumber,
  mainPhone,
  compact = false,
}: {
  customerNumber: string | null | undefined;
  /** הטלפון הראשי כפי שמופיע על הקריאה או העצירה. */
  mainPhone?: string | null;
  compact?: boolean;
}) {
  const { data, isLoading, error } = useCustomerPhoneBook(customerNumber);
  const add = useAddCustomerContact(customerNumber);
  const [phone, setPhone] = useState('');
  const [label, setLabel] = useState('');
  const [note, setNote] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  if (!customerNumber) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50/60 p-2.5 text-xs text-muted-foreground">
        אין מספר לקוח על הרשומה הזאת, ולכן אי אפשר לקשר אליה טלפון נוסף.
      </p>
    );
  }

  const entries = buildPhoneBook(mainPhone, data ?? []);
  const normalized = normalizeMobile(phone);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!normalized) {
      setNote({ tone: 'err', text: addErrorLine('not a mobile number') });
      return;
    }
    setNote(null);
    add.mutate(
      { phone: normalized, label: label || null },
      {
        onSuccess: (r) => {
          setNote({ tone: r.result === 'added' ? 'ok' : 'err', text: addResultLine(r.result, r.phone_local) });
          if (r.result === 'added') { setPhone(''); setLabel(''); }
        },
        onError: (err) => setNote({ tone: 'err', text: addErrorLine(err instanceof Error ? err.message : String(err)) }),
      },
    );
  };

  return (
    <div className="space-y-2">
      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> טוען טלפונים…
        </div>
      ) : error ? (
        <p className="text-xs text-red-700">לא הצלחנו לטעון את הטלפונים של הלקוח.</p>
      ) : (
        <ul className="space-y-1">
          {entries.length === 0 && (
            <li className="text-xs text-muted-foreground">אין טלפון רשום ללקוח הזה.</li>
          )}
          {entries.map((e) => <PhoneLine key={`${e.kind}-${e.phone}`} entry={e} compact={compact} />)}
        </ul>
      )}

      <form onSubmit={submit} className="rounded-lg border bg-slate-50/70 p-2" data-testid="add-contact-form">
        <div className="mb-1 text-[11.5px] font-semibold text-slate-700">טלפון נוסף מהלקוח</div>
        <div className="flex flex-wrap gap-1.5">
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            dir="ltr"
            placeholder="05X-XXXXXXX"
            aria-label="מספר נייד נוסף"
            className="h-9 min-w-[9rem] flex-1 bg-white text-[16px] sm:text-sm"
          />
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="מי זה (הבת, מיכל)"
            aria-label="מי זה"
            className="h-9 min-w-[8rem] flex-1 bg-white text-[16px] sm:text-sm"
          />
          <Button type="submit" size="sm" className="h-9 gap-1" disabled={add.isPending || !phone.trim()}>
            {add.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            הוסף
          </Button>
        </div>
        <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
          מספר שנוסף כאן מקבל את ההודעות האוטומטיות (בקשת תמונות, תזכורת, סקר) יחד עם הטלפון הראשי,
          ונכתב לפריוריטי כאיש קשר של הלקוח. הטלפון הראשי בכרטיס הלקוח נשאר כמו שהוא בפריוריטי.
        </p>
        {note && (
          <p className={`mt-1 text-[12px] ${note.tone === 'ok' ? 'text-emerald-700' : 'text-red-700'}`} role="status">
            {note.text}
          </p>
        )}
      </form>
    </div>
  );
}

const KIND_TAG: Record<PhoneBookEntry['kind'], { text: string; cls: string }> = {
  main: { text: 'ראשי', cls: 'bg-slate-800 text-white' },
  linked: { text: 'מקושר', cls: 'bg-emerald-100 text-emerald-800' },
  priority: { text: 'איש קשר בפריוריטי', cls: 'bg-slate-100 text-slate-600' },
};

function PhoneLine({ entry, compact }: { entry: PhoneBookEntry; compact: boolean }) {
  const tag = KIND_TAG[entry.kind];
  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px]">
      <a href={`tel:${entry.phone}`} dir="ltr" className="flex items-center gap-1 font-mono font-semibold text-blue-700 hover:underline">
        <Phone className="h-3 w-3" />
        {formatMobile(entry.phone)}
      </a>
      <span className={`rounded px-1.5 text-[10.5px] font-medium ${tag.cls}`}>{tag.text}</span>
      {entry.label && <span className="text-slate-700">{entry.label}</span>}
      {!compact && entry.kind === 'linked' && (
        <span className="text-[10.5px] text-muted-foreground">
          {entry.priorityPushedAt ? 'נכתב לפריוריטי' : 'ממתין לכתיבה לפריוריטי'}
          {entry.createdBy ? ` · ${entry.createdBy}` : ''}
        </span>
      )}
    </li>
  );
}
