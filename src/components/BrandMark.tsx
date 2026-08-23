import { cn } from '@/lib/utils';

/**
 * הסמל של ר.שעל.
 *
 * ⭐ **הסמל בלבד, בלי הכיתוב.** קובץ הלוגו המקורי
 * (`public/rashal-logo.png`) מחזיק את הזר ומתחתיו "R.SHAL" באותיות
 * גדולות. בריבוע של 36 פיקסלים הכיתוב הופך לכתם, ולכן `rashal-mark.png`
 * הוא החיתוך של הזר בלבד, מרובע ועם רקע שקוף. הלוגו המלא נשאר לשימוש
 * במקומות שיש בהם מקום, כמו מסך ההתחברות ועמוד הסקר.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <img
      src="/rashal-mark.png"
      alt="ר.שעל ציוד רפואי"
      className={cn('object-contain', className)}
      // מוצג בכל טעינת עמוד ואין טעם לדחות אותו
      loading="eager"
      decoding="async"
      draggable={false}
    />
  );
}
