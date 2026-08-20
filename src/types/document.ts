// מסמכים כספיים מפריוריטי: תעודת משלוח (DOCUMENTS_D) וחשבונית מס (AINVOICES).
//
// "פתוח" בשתיהן = סטטוס 'טיוטא', כלומר המסמך טרם נסגר סופית (הכרעת עידן 20/08).
// לא לבלבל עם "לא שולמה" — מידע גבייה יושב ב-GENINVOICES שאינו פתוח ב-API.

export type DocStatus = 'טיוטא' | 'סופית' | 'מבוטלת';

export interface DeliveryNote {
  id: string;
  priorityDocId: string;        // DOCNO, בפורמט SH...
  customerNumber?: string;
  customerName?: string;
  docDate?: string;             // CURDATE — מתי נפתחה
  status?: DocStatus;
  /** IVALL מפריוריטי: 'Y' = חויבה במלואה. שדה חי, לא ריק (נמדד 20/08). */
  invoiced?: string;
  sourceOrder?: string;
  warehouse?: string;
  agent?: string;
  openedBy?: string;
  totalQty?: number;
  totalPrice?: number;
  /** UDATE — העדכון האחרון. עבור מסמך שאינו טיוטא זהו בקירוב רגע הסגירה. */
  priorityUdate?: string;
}

export interface Invoice {
  id: string;
  priorityIvId: string;         // IVNUM, בפורמט IN...
  customerNumber?: string;
  customerName?: string;
  invoiceDate?: string;         // IVDATE
  status?: DocStatus;
  sourceOrder?: string;
  agent?: string;
  bookNum?: string;
  fncNum?: string;
  /** IVRECONDATE = התאמת מסמכים, לא גבייה. אומת: גם מבוטלות מסומנות מותאמות. */
  reconDate?: string;
  vat?: number;
  totalPrice?: number;
}

/**
 * חשבונית מרכזת (CINVOICES). זהו מקור החיוב האמיתי אצל ר.שעל:
 * 2,998 מסמכים ב-2026 מול 54 ב-AINVOICES.
 *
 * 🔴 הסטטוסים כאן אינם טיוטא/סופית/מבוטלת בלבד. מחזור החיים הוא שידור EDI
 * לקופות החולים: 'vEDI-PENDING' ⟵ ממתינה לשידור, 'vEDI-SENT' ⟵ שודרה.
 * "פתוחה" = טרם שודרה, כלומר טיוטא או vEDI-PENDING (הכרעת עידן 20/08).
 */
export interface ConsolidatedInvoice {
  id: string;
  priorityIvId: string;
  docNo?: string;
  customerNumber?: string;
  customerName?: string;
  invoiceDate?: string;
  status?: string;
  totalPrice?: number;
}

/** הסטטוסים שמשמעותם "החשבונית עוד לא יצאה לקופה". */
export const CINVOICE_NOT_SENT = ['טיוטא', 'vEDI-PENDING'];
