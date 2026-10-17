import type { FormDefinition } from '../types.ts';

/**
 * ✅ כללית, אספקה: **אין טופס שלנו.** לפי עמי (04/08/2026) הטופס נמשך
 * מהפורטל של כללית כשפרטי הלקוח כבר בתוכו, ונחתם על הנייר עצמו ("אין בהם
 * שורת החתמה, ההחתמה מתבצעת שרירותית על הטפסים עצמם"). לכן הטכנאי מצלם את
 * הטופס החתום, וזה הכל. הצילום נכנס ל-PDF ולפריוריטי כמו כל טופס.
 *
 * 🔴 החליף את טופס ההדגמה של 11/08 (`isDemo`), שנבנה לפני שהיה בידינו המקור.
 */
export const clalitDelivery: FormDefinition = {
  key: 'clalit-delivery',
  kind: 'delivery',
  healthFundMatches: ['כללית'],
  fundLabel: 'כללית',
  title: 'טופס אספקה מהפורטל של כללית, חתום',
  brandColor: '#00558C',
  photoOnly: true,
  sections: [],
  signatures: [],
  photos: [
    {
      key: 'portalForm', label: 'טופס האספקה של כללית, חתום על ידי הלקוח', required: true,
      hint: 'הטופס שהודפס מהפורטל של כללית. לצלם את כל הדף, כולל החתימה',
    },
    { key: 'portalForm2', label: 'עמוד נוסף, אם יש', required: false },
  ],
};
