// מנוע הטפסים — טיפוסים
//
// כל טופס של קופת חולים הוא *הגדרה*, לא קוד. הוספת קופה או החלפת טופס קיים
// היא עריכת קובץ הגדרה אחד. זה הדבר היחיד שמאפשר להבטיח שהחלפת טופס הדמו של
// כללית בטופס האמיתי לא תדרוש נגיעה בקוד.
//
// הסייג היחיד: אם לטופס האמיתי יש שדה שאין לו מקור נתונים אצלנו, צריך להוסיף
// אותו ל-FormContext. לכן קבוצת השדות בהגדרות בנויה מהמכנה המשותף שחוזר בכל
// ארבע הקופות, ולא מטופס אחד ספציפי.

export type FormKind = 'delivery' | 'return' | 'repair';

export type FieldType =
  | 'text'
  | 'tel'
  | 'id'          // תעודת זהות — 9 ספרות
  | 'date'
  | 'number'
  | 'money'
  | 'checkbox'
  | 'radio'
  | 'textarea';

/** מפתח ב-FormContext שממנו נשאב ערך ההתחלה של השדה. */
export type PrefillKey = keyof FormContext;

export interface FormField {
  key: string;
  label: string;
  type: FieldType;
  /** מאיפה מגיע הערך ההתחלתי. השדה נשאר ניתן לעריכה אלא אם readOnly. */
  prefill?: PrefillKey;
  required?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  /** רוחב בתוך הרשת של הסעיף. ברירת מחדל 1. */
  span?: 1 | 2 | 3;
  options?: { value: string; label: string }[];
  /** רמז לנהג מתחת לשדה. */
  hint?: string;
  /**
   * ערך פתיחה משורה בהזמנה או באיסוף (טבלת המכשירים). `index` מ-0.
   * ⭐ נפרד מ-`prefill` כי מספר השורות משתנה מעצירה לעצירה.
   */
  fromLine?: { index: number; prop: keyof FormLine };
}

/** שורת מכשיר אחת מההזמנה, מהאיסוף או מהקריאה. */
export interface FormLine {
  name: string;
  serial: string;
  catalog: string;
}

export interface FormSection {
  title: string;
  fields: FormField[];
}

export interface SignatureSlot {
  /** `guarantor` = ערב או מקבל שאינו הזכאי (מאוחדת). נשמר ב-payload, אין לו עמודה. */
  key: 'customer' | 'driver' | 'guarantor';
  label: string;
  /** שדה השם שמלווה את החתימה. */
  nameLabel: string;
  required: boolean;
}

export interface FormDefinition {
  key: string;
  kind: FormKind;
  /** ערכי health_fund מהמסד שממופים לטופס הזה. ההתאמה היא לפי הכלה, לא שוויון. */
  healthFundMatches: string[];
  fundLabel: string;
  title: string;
  subtitle?: string;
  /** צבע המותג של הקופה, לכותרת הטופס. */
  brandColor: string;
  sections: FormSection[];
  /** סעיפי הצהרת הלקוח, מוצגים מעל החתימה. */
  declarations?: string[];
  /**
   * `lettered` (ברירת מחדל): המנוע ממספר א, ב, ג. `plain`: הטקסט כבר נושא
   * את המספור שלו (מאוחדת, שבה יש א/ב ובתוכם 1-10).
   */
  declarationStyle?: 'lettered' | 'plain';
  signatures: SignatureSlot[];
  footerNote?: string;
  /**
   * חלקים שנשארים על נייר ומצולמים: טופס הפורטל של כללית, שטר חוב, צילום
   * ת"ז. 🔴 שטר חוב לא נחתם אצלנו דיגיטלית, ראה `definitions/README`.
   * התמונות נכנסות לאותו PDF כעמודים נוספים, כך שלפריוריטי מגיע קובץ אחד.
   */
  photos?: PhotoSlot[];
  /** טופס שכל כולו צילום של נייר (בלי שדות ובלי חתימה על המסך). */
  photoOnly?: boolean;
  /**
   * טופס שנבנה כהדגמה ולא הועתק מטופס אמיתי של הקופה. מוצג עם סרט אזהרה
   * בכל מקום, כדי שלא ייחתם בטעות מול לקוח אמיתי.
   */
  isDemo?: boolean;
}

/**
 * כל מה שהמערכת יודעת על העצירה ברגע פתיחת הטופס. השדות שאין לנו כרגע
 * (בעיקר ת"ז) מגיעים ריקים והנהג משלים בשטח.
 */
export interface FormContext {
  customerName: string;
  firstName: string;
  lastName: string;
  idNumber: string;
  phone: string;
  phoneAlt: string;
  address: string;
  houseNumber: string;
  city: string;
  zipCode: string;
  /** "רחוב מספר, יישוב" בשורה אחת, לטפסים שמבקשים כתובת בשדה אחד. */
  fullAddress: string;
  customerNumber: string;
  healthFund: string;

  orderNumber: string;
  callNumber: string;

  deviceName: string;
  deviceModel: string;
  deviceSerial: string;
  deviceDesc: string;
  installDate: string;
  warrantyUntil: string;
  faultDesc: string;
  items: string;

  supplierName: string;
  driverName: string;
  today: string;
  empty: string;
}

export const EMPTY_CONTEXT: FormContext = {
  customerName: '', firstName: '', lastName: '', idNumber: '',
  phone: '', phoneAlt: '', address: '', houseNumber: '', city: '', zipCode: '', fullAddress: '',
  customerNumber: '', healthFund: '',
  orderNumber: '', callNumber: '',
  deviceName: '', deviceModel: '', deviceSerial: '', deviceDesc: '',
  installDate: '', warrantyUntil: '', faultDesc: '', items: '',
  supplierName: 'ר.שעל', driverName: '', today: '', empty: '',
};

export interface PhotoSlot {
  key: string;
  label: string;
  required: boolean;
  hint?: string;
}

export type FormValues = Record<string, string | boolean>;
