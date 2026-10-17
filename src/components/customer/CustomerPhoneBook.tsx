import { useState } from 'react';
import { Loader2, Phone, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAddCustomerContact, useCustomerPhoneBook, useSetAutoMessages } from '@/hooks/useCustomerPhoneBook';
import { useIsOfficeEditor } from '@/hooks/useProfile';
import {
  addErrorLine, addResultLine, autoToggleErrorLine, buildPhoneBook, formatMobile, hasAutoSwitch,
  isLastAutoRecipient, normalizeMobile, type PhoneBookEntry,
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
  const toggle = useSetAutoMessages(customerNumber);
  // ⭐ המתג רק למשרד. טכנאי רואה את המצב (מקבל או לא) בלי לשנות אותו.
  const canToggle = useIsOfficeEditor();
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
          {entries.map((e) => (
            <PhoneLine
              key={`${e.kind}-${e.phone}`}
              entry={e}
              compact={compact}
              canToggle={canToggle}
              isLast={isLastAutoRecipient(entries, e.phone)}
              busy={toggle.isPending && toggle.variables?.phone === e.phone}
              onToggle={(enabled) => {
                setNote(null);
                toggle.mutate(
                  { phone: e.phone, enabled },
                  {
                    onSuccess: () => setNote({
                      tone: 'ok',
                      text: enabled
                        ? `${formatMobile(e.phone)} יקבל שוב את ההודעות האוטומטיות.`
                        : `${formatMobile(e.phone)} לא יקבל יותר הודעות אוטומטיות של הלקוח הזה.`,
                    }),
                    onError: (err) => setNote({ tone: 'err', text: autoToggleErrorLine(err instanceof Error ? err.message : String(err)) }),
                  },
                );
              }}
            />
          ))}
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
          מספר שנוסף כאן מקבל את ההודעות האוטומטיות (בקשת תמונות, בדרך אליך, סקר) יחד עם הטלפון הראשי,
          ונכתב לפריוריטי כאיש קשר של הלקוח. המתג ליד כל מספר קובע אם הוא מקבל אותן. הטלפון הראשי בכרטיס
          הלקוח נשאר כמו שהוא בפריוריטי.
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

function PhoneLine({
  entry, compact, canToggle, isLast, busy, onToggle,
}: {
  entry: PhoneBookEntry;
  compact: boolean;
  canToggle: boolean;
  isLast: boolean;
  busy: boolean;
  onToggle: (enabled: boolean) => void;
}) {
  const tag = KIND_TAG[entry.kind];
  const on = !entry.autoMuted;
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
      {hasAutoSwitch(entry) && (
        canToggle ? (
          <AutoSwitch on={on} busy={busy} lockedOn={on && isLast} onChange={onToggle} />
        ) : (
          <span className={`text-[10.5px] ${on ? 'text-emerald-700' : 'text-slate-500'}`}>
            {on ? 'מקבל הודעות אוטומטיות' : 'לא מקבל הודעות אוטומטיות'}
          </span>
        )
      )}
    </li>
  );
}

/**
 * ⭐ המתג "הודעות אוטומטיות" (עידן, 13/10/2026: "הוא יקבל את ההודעות אבל יהיה
 * מנגנון שיאפשר להעביר למספר השני"). כבוי = המספר הזה לא מקבל בקשת תמונה,
 * "בדרך אליך" וסקר של הלקוח. האחרון שדולק נעול, כי לקוח בלי נמען מפסיק
 * לקבל הכל בשקט, והמסד אוכף את אותו כלל.
 */
function AutoSwitch({
  on, busy, lockedOn, onChange,
}: { on: boolean; busy: boolean; lockedOn: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label="מקבל הודעות אוטומטיות"
      disabled={busy || lockedOn}
      title={lockedOn ? 'זה המספר היחיד שמקבל הודעות אוטומטיות. הפעילו קודם מספר אחר.' : undefined}
      onClick={() => onChange(!on)}
      className="ms-auto inline-flex items-center gap-1.5 rounded-full py-0.5 text-[11px] text-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className={on ? 'text-emerald-700' : 'text-slate-500'}>
        {on ? 'מקבל הודעות אוטומטיות' : 'לא מקבל הודעות אוטומטיות'}
      </span>
      <span className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${on ? 'bg-emerald-500' : 'bg-slate-300'}`}>
        <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all ${on ? 'start-3.5' : 'start-0.5'}`} />
      </span>
      {busy && <Loader2 className="h-3 w-3 animate-spin" />}
    </button>
  );
}
