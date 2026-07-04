export type ServiceCallStatus = 'קריאה חדשה' | 'תואם ביקור' | 'בוצע' | 'בוטל';

export interface ServiceCall {
  id: string;
  customerName: string;
  /** מספר לקוח מפריוריטי (CUSTNAME). נמשך דרך Make. */
  customerNumber?: string;
  phone?: string;
  customerStatus?: 'לקוח חדש' | 'לקוח קיים';
  healthFund?: string;
  openedBy?: string;
  address?: string;
  city?: string;
  serviceCallStatus?: ServiceCallStatus;
  /** פרטי המכשיר מפריוריטי (עמי #4) — נמשכים בסנכרון מ-DOCUMENTS_Q. */
  deviceSerial?: string;
  deviceName?: string;
  deviceDesc?: string;
  warrantyUntil?: string;
  installDate?: string;
  /** מה בתקלה (עמי #2) — מ-DOCUMENTS_Q. */
  faultDesc?: string;
  symptomDesc?: string;
  callType?: string;
  serviceType?: string;
  /** If set, this row is a Priority dupe of the referenced head row. */
  duplicateOf?: string;
  created: string;
}
