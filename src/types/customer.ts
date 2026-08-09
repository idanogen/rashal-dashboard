/**
 * לקוח חדש שנפתח בפריוריטי.
 *
 * ברשעל אספקה נשענת ברוב המקרים על פתיחת לקוח חדש, ולא על הזמנה. הזמנה לא
 * תמיד נפתחת, ואם היא נפתחת היא עלולה להיסגר מיד. לכן לקוח חדש בלי שום
 * רשומה נלווית הוא אספקה שממתינה, ולא סתם שורה בטבלת עזר.
 */
export interface NewCustomer {
  /** CUSTNAME — קוד/מספר הלקוח בפריוריטי. המזהה היחיד. */
  customerNumber: string;
  /** CUSTDES — שם הלקוח. */
  customerName: string;
  address?: string;
  city?: string;
  phone?: string;
  fax?: string;
  agent?: string;
  healthFund?: string;
  /** מי פתח את הלקוח בפריוריטי. */
  openedBy?: string;
  /** תאריך הפתיחה בפריוריטי. */
  openedAt?: string;

  /** האם כבר קיימת רשומה נלווית ללקוח. */
  hasOrder: boolean;
  hasServiceCall: boolean;
  hasPickup: boolean;
  /** האם כבר שובץ ליומן כעצירת לקוח פעילה. */
  isScheduled: boolean;
}

/** לקוח בלי שום רשומה נלווית — אספקה שאף אחד לא יודע עליה. */
export function isBareCustomer(c: NewCustomer): boolean {
  return !c.hasOrder && !c.hasServiceCall && !c.hasPickup;
}
