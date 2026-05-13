export type CraneModel = 'G150' | 'G175';

export type CustomerType =
  | 'כללית הנדסה'
  | 'משרד הבריאות'
  | 'מכבי'
  | 'מאוחדת'
  | 'לאומית'
  | 'משרד הבטחון'
  | 'לשכות בריאות'
  | 'שירותים';

export interface Crane {
  id: string;
  deviceNumber: string;
  model: CraneModel | string;
  customerIdNumber?: string;
  customerName?: string;
  customerType?: string;
  customerTypeCode?: string;
  phone?: string;
  stickerNumber?: string;
  installDate?: string;
  openedDate?: string;
  warrantyStart?: string;
  warrantyEnd?: string;
  cancelledAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type InspectionStatus =
  | 'planned'
  | 'scheduled'
  | 'completed'
  | 'failed'
  | 'cancelled';

export const INSPECTION_STATUS_LABEL: Record<InspectionStatus, string> = {
  planned: 'מתוכננת',
  scheduled: 'משובצת ביומן',
  completed: 'בוצעה',
  failed: 'נכשלה',
  cancelled: 'בוטלה',
};

export interface CraneInspection {
  id: string;
  craneId: string;
  inspectionDate: string;
  nextDueDate?: string;
  status: InspectionStatus;
  technician?: string;
  result?: string;
  defects?: string;
  certificateNumber?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CraneSyncHistory {
  id: string;
  syncedAt: string;
  sourceFilename?: string;
  totalRowsInFile: number;
  newCranesCount: number;
  updatedCranesCount: number;
  unchangedCount: number;
  missingInFileCount: number;
  conflictSummary?: Record<string, unknown>;
  performedBy?: string;
  notes?: string;
}

/**
 * Holds the last completed inspection (if any) and the next-due date for a crane.
 * Computed from `crane_inspections` + the crane's install_date.
 */
export interface CraneStatus {
  craneId: string;
  lastInspectionDate?: string;
  nextDueDate?: string;
  /** Days until next inspection; negative = overdue. null = unknown (no install_date and no inspections) */
  daysUntilDue: number | null;
  /** Bucket for UI sorting/coloring */
  urgency: 'overdue' | 'due_soon' | 'ok' | 'unknown';
}

export const URGENCY_LABEL: Record<CraneStatus['urgency'], string> = {
  overdue: 'פג תוקף',
  due_soon: 'בחודשיים הקרובים',
  ok: 'תקין',
  unknown: 'ללא תאריך התקנה',
};
