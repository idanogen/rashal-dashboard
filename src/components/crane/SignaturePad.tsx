import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Eraser } from 'lucide-react';

/**
 * חתימה מצוירת על המסך.
 *
 * ⭐ **נכתב ידנית ולא נלקחה ספרייה**, כי כל מה שצריך הוא קנבס ושלושה
 * מאזינים, וספרייה נוספת בחבילה שכבר עומדת על 2.2 מגה אינה שווה את זה.
 *
 * 🔴 **המלכודות שבגללן זה לא טריוויאלי, וכולן נבדקו בטלפון:**
 * 1. `touchmove` חייב `preventDefault`, אחרת הדף נגרר תחת האצבע והחתימה
 *    יוצאת קו אחד קרוע. ⭐ ולכן המאזין נרשם ידנית עם `passive: false`;
 *    React רושם מאזיני מגע כ-passive ו-`preventDefault` בתוכו לא עובד.
 * 2. הקנבס חייב להימתח לפי `devicePixelRatio`, אחרת החתימה מטושטשת על
 *    מסך רטינה, וחתימה מטושטשת על טופס בטיחות נראית כמו זיוף.
 * 3. הקואורדינטות נגזרות מ-`getBoundingClientRect` ולא מ-`offsetX`,
 *    כי `offsetX` אינו קיים באירועי מגע.
 */
export function SignaturePad({
  onChange,
  height = 150,
}: {
  /** נקרא עם data URL, או null כשהחתימה נמחקה. */
  onChange: (dataUrl: string | null) => void;
  height?: number;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  /**
   * 🔴🔴 **ref ולא state, וזה לא ניקיון אלא באג שנתפס.**
   * ההחלטה "האם יש דיו" נקראת בתוך המאזין ל-`mouseup`. כשהיא הייתה
   * state, הסגור של `end` החזיק את הערך מהרינדור שבו הוא נרשם, ומשיכה
   * שלמה שמתרחשת בתוך אצווה אחת (בלי רינדור בין `move` ל-`up`) הסתיימה
   * עם `false`, כלומר **החתימה צוירה על המסך ולא נשמרה**, והשער אמר
   * "חסרה חתימה" מול חתימה שרואים. נתפס בצילום אוטומטי ב-27/08/2026.
   * ⭐ ה-state נשאר, אבל רק בשביל מה שרואים: כיתוב הרמז וכפתור המחיקה.
   */
  const inked = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  const ctxOf = useCallback(() => {
    const c = ref.current;
    return c ? c.getContext('2d') : null;
  }, []);

  // 🔴 מתיחה לפי צפיפות הפיקסלים של המסך. בלי זה החתימה מטושטשת.
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = Math.round(rect.width * dpr);
    c.height = Math.round(height * dpr);
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#14223a';
  }, [height]);

  const pointFrom = (e: MouseEvent | TouchEvent) => {
    const c = ref.current;
    if (!c) return null;
    const r = c.getBoundingClientRect();
    const src = 'touches' in e ? e.touches[0] : e;
    if (!src) return null;
    return { x: src.clientX - r.left, y: src.clientY - r.top };
  };

  useEffect(() => {
    const c = ref.current;
    if (!c) return;

    const start = (e: MouseEvent | TouchEvent) => {
      const p = pointFrom(e);
      const ctx = ctxOf();
      if (!p || !ctx) return;
      drawing.current = true;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
    };
    const move = (e: MouseEvent | TouchEvent) => {
      if (!drawing.current) return;
      // 🔴 בלי זה הדף נגרר תחת האצבע והחתימה נקרעת.
      if ('touches' in e) e.preventDefault();
      const p = pointFrom(e);
      const ctx = ctxOf();
      if (!p || !ctx) return;
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      if (!inked.current) {
        inked.current = true;
        setHasInk(true);
      }
    };
    const end = () => {
      if (!drawing.current) return;
      drawing.current = false;
      const c2 = ref.current;
      if (c2 && inked.current) onChange(c2.toDataURL('image/png'));
    };

    c.addEventListener('mousedown', start);
    c.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
    // 🔴 `passive: false` — React רושם מאזיני מגע כ-passive, ואז
    // `preventDefault` בתוכם אינו עושה כלום.
    c.addEventListener('touchstart', start, { passive: false });
    c.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', end);

    return () => {
      c.removeEventListener('mousedown', start);
      c.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', end);
      c.removeEventListener('touchstart', start);
      c.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', end);
    };
    // 🔴 בלי `hasInk` בתלויות: המאזינים נרשמים פעם אחת, וההחלטה נקראת
    // מה-ref. רישום מחדש באמצע משיכה הוא בדיוק מה שאיבד את החתימה.
  }, [ctxOf, onChange]);

  const clear = () => {
    const c = ref.current;
    const ctx = ctxOf();
    if (!c || !ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    inked.current = false;
    setHasInk(false);
    onChange(null);
  };

  return (
    <div>
      <div className="relative rounded-lg border-2 border-dashed border-slate-300 bg-white">
        <canvas ref={ref} style={{ width: '100%', height, touchAction: 'none' }} />
        {!hasInk && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-slate-400">
            חתום/י כאן באצבע
          </span>
        )}
      </div>
      {hasInk && (
        <Button type="button" variant="ghost" size="sm" onClick={clear} className="mt-1 h-8 gap-1 text-xs">
          <Eraser className="h-3.5 w-3.5" />
          מחק וחתום מחדש
        </Button>
      )}
    </div>
  );
}
