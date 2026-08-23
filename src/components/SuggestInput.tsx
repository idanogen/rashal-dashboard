import { useId, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { filterSuggestions } from '@/lib/suggestion-filter';
import { cn } from '@/lib/utils';

/**
 * שדה טקסט שמציע ערכים שכבר נרשמו במערכת.
 *
 * 🔴 **הרשימה נפתחת רק אחרי אינטראקציה של המשתמש** (מיקוד או הקלדה),
 * אף פעם לא מרינדור. פאנל שנפתח לבד מכסה את השדה הבא ונקרא כמו תקלה.
 * זה הלקח מלולאת המיקוד שקרתה כאן בעבר.
 *
 * ⭐ ואין כאן `<datalist>`: הוא לא ניתן לעיצוב, מתנהג אחרת בכל דפדפן,
 * ומתעלם מסדר החשיבות שהשרת החזיר.
 */
interface SuggestInputProps {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  dir?: 'rtl' | 'ltr';
  className?: string;
  /** נקרא כשנבחרה הצעה מהרשימה (בלחיצה או ב-Enter). */
  onPick?: (v: string) => void;
}

export function SuggestInput({
  id,
  value,
  onChange,
  options,
  placeholder,
  dir,
  className,
  onPick,
}: SuggestInputProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const blurTimer = useRef<number | null>(null);

  const matches = useMemo(() => filterSuggestions(options, value), [options, value]);
  const visible = open && matches.length > 0;

  const choose = (v: string) => {
    onChange(v);
    onPick?.(v);
    setOpen(false);
    setActive(-1);
  };

  return (
    <div className="relative">
      <Input
        id={id}
        value={value}
        dir={dir}
        placeholder={placeholder}
        className={className}
        role="combobox"
        aria-expanded={visible}
        aria-controls={listId}
        aria-autocomplete="list"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // 🔴 השהיה קצרה: לחיצה על הצעה מפעילה blur לפני click, ובלעדיה
          // הרשימה נסגרת והלחיצה נופלת על כלום.
          blurTimer.current = window.setTimeout(() => setOpen(false), 120);
        }}
        onKeyDown={(e) => {
          if (!visible) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((i) => (i + 1) % matches.length);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((i) => (i <= 0 ? matches.length - 1 : i - 1));
          } else if (e.key === 'Enter' && active >= 0) {
            e.preventDefault();
            choose(matches[active]);
          } else if (e.key === 'Escape') {
            setOpen(false);
            setActive(-1);
          }
        }}
      />

      {visible && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-popover p-1 shadow-md"
          onMouseDown={() => {
            if (blurTimer.current) window.clearTimeout(blurTimer.current);
          }}
        >
          {matches.map((m, idx) => (
            <li key={m}>
              <button
                type="button"
                role="option"
                aria-selected={idx === active}
                onClick={() => choose(m)}
                onMouseEnter={() => setActive(idx)}
                className={cn(
                  'w-full truncate rounded px-2 py-1.5 text-start text-sm',
                  idx === active ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60',
                )}
              >
                {m}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
