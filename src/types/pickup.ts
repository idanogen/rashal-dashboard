// מסך "איסופים" — DOCUMENTS_N מפריוריטי (ראה docs/PICKUPS-PLAN.md)

/** סטטוס תפעולי (בבעלות האפליקציה, לא נדרס ע"י ה-pull). */
export type PickupStatus = 'ממתין לתאום' | 'תואם איסוף' | 'נאסף' | 'בוטל';

/** שורת פריט לאיסוף — מקורה ב-TRANSORDER_N_SUBFORM. */
export interface PickupLine {
  /** TRANS — מפתח השורה בפריוריטי */
  trans?: number;
  /** KLINE — מספר שורה במסמך */
  kline?: number;
  /** PARTNAME — מק"ט */
  part?: string;
  /** PDES — תיאור פריט */
  desc?: string;
  /** TQUANT — כמות */
  qty?: number;
  /** TUNITNAME — יחידת מידה */
  unit?: string;
  /** BARCODE */
  barcode?: string;
  /** ORDNAME — הזמנת מקור */
  sourceOrder?: string;
  /** RETREASONDES — סיבת החזרה */
  returnReason?: string;
}

export interface Pickup {
  id: string;
  /** DOCNO (RT...) — המפתח הטבעי מפריוריטי */
  priorityPickupId?: string;
  /** DOC — מזהה מספרי פנימי */
  priorityDoc?: number;
  /** CUSTNAME */
  customerNumber?: string;
  /** CDES */
  customerName: string;
  phone?: string;
  address?: string;
  city?: string;
  /** STATDES מפריוריטי (טיוטא / סופית) — אינפורמטיבי */
  priorityStatus?: string;
  /** סטטוס תפעולי בבעלות האפליקציה */
  pickupStatus?: PickupStatus;
  /** CURDATE */
  pickupDate?: string;
  /** ORDNAME — הזמנת מקור */
  sourceOrder?: string;
  /** ODOCNO — תעודת משלוח מקושרת */
  deliveryNote?: string;
  reference?: string;
  /** TOWARHSDES — מחסן יעד (לאן אוספים) */
  toWarehouse?: string;
  agent?: string;
  openedBy?: string;
  totalQty?: number;
  totalPrice?: number;
  lines?: PickupLine[];
  /** אם מוגדר — השורה היא כפילות Priority של שורת-הראש המקושרת. */
  duplicateOf?: string;
  created: string;
}
