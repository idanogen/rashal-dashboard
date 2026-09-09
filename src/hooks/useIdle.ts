import { useEffect, useRef, useState } from 'react';

/**
 * האם אין אדם מול המסך כרגע.
 *
 * 🔴 **נולד ממדידה, לא מהרגשה (08/09/2026).** תיבת השיחות שאבה 14,077
 * בקשות ביממה כדי לתפוס בערך 60 הודעות, וכתובת IP אחת של המשרד בר.שעל
 * ייצרה 10,621 מהן ולא ירדה לאפס גם בשלוש לפנות בוקר. טיימר לא יודע
 * להבחין בין סדרן שמחכה לתשובת לקוח לבין מסך שנשאר דולק.
 *
 * ⭐ **מוריד הילוך, לא עוצר.** מסך שמישהו משאיר דולק בכוונה ככרטיס מצב
 * על הקיר חייב להמשיך להתעדכן, ולכן הקוראים משתמשים בערך הזה כדי לבחור
 * קצב איטי יותר ואף פעם לא כדי לכבות רענון. הערוץ החי ובדיקת הטריות
 * ממשיכים לרוץ בלי קשר, וזה מה שמונע חזרה על התקלה של 07/09 שבה מסך
 * שנשאר פתוח קפא עד F5.
 *
 * 🔴 **החזרה מיידית.** התנועה הראשונה מאפסת את המצב באותו רגע, ולכן מי
 * שחוזר לשולחן לא ממתין לסבב הבא.
 *
 * @param afterMs כמה זמן בלי אינטראקציה נחשב "אין אדם" (ברירת מחדל: 5 דקות)
 */
export function useIdle(afterMs = 5 * 60_000): boolean {
  const [idle, setIdle] = useState(false);
  // ⭐ ref ולא state: המאזינים נרשמים פעם אחת, בלי לבנות אותם מחדש בכל
  // תזוזת עכבר.
  const idleRef = useRef(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const goIdle = () => {
      idleRef.current = true;
      setIdle(true);
    };

    const wake = () => {
      if (idleRef.current) {
        idleRef.current = false;
        setIdle(false);
      }
      if (timer) clearTimeout(timer);
      timer = setTimeout(goIdle, afterMs);
    };

    // 🔴 `visibilitychange` לבד לא מספיק: טאב גלוי על מסך נטוש הוא בדיוק
    // המקרה שאכל את החשבון. לכן מקשיבים לאינטראקציה אמיתית.
    const EVENTS = ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart', 'focus'] as const;
    for (const e of EVENTS) window.addEventListener(e, wake, { passive: true });

    const onVisible = () => { if (document.visibilityState === 'visible') wake(); };
    document.addEventListener('visibilitychange', onVisible);

    wake();

    return () => {
      if (timer) clearTimeout(timer);
      for (const e of EVENTS) window.removeEventListener(e, wake);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [afterMs]);

  return idle;
}
