export type ServiceCallStatus = 'קריאה חדשה' | 'תואם ביקור' | 'בוצע' | 'בוטל';

export interface ServiceCall {
  id: string;
  customerName: string;
  phone?: string;
  customerStatus?: 'לקוח חדש' | 'לקוח קיים';
  healthFund?: string;
  openedBy?: string;
  city?: string;
  serviceCallStatus?: ServiceCallStatus;
  /** If set, this row is a Priority dupe of the referenced head row. */
  duplicateOf?: string;
  created: string;
}
