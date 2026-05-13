import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Phone } from 'lucide-react';
import { useInspectionsByCrane, useDeleteInspection } from '@/hooks/useCraneInspections';
import { INSPECTION_STATUS_LABEL } from '@/types/crane';
import type { Crane, CraneStatus, InspectionStatus } from '@/types/crane';
import { CreateInspectionDialog } from './CreateInspectionDialog';

interface CraneDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  crane: Crane | null;
  status?: CraneStatus;
}

export function CraneDetailDialog({ open, onOpenChange, crane, status }: CraneDetailDialogProps) {
  const { data: inspections = [], isLoading } = useInspectionsByCrane(crane?.id ?? null);
  const deleteInspection = useDeleteInspection();
  const [createOpen, setCreateOpen] = useState(false);

  if (!crane) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {crane.customerName ?? 'מנוף ללא שם'}
              <Badge variant="outline" className="font-mono text-xs">{crane.deviceNumber}</Badge>
              <Badge>{crane.model}</Badge>
            </DialogTitle>
            <DialogDescription>
              {crane.customerType ?? '—'}
            </DialogDescription>
          </DialogHeader>

          {/* Crane summary grid */}
          <div className="rounded-md border bg-muted/20 p-3">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
              <Detail label="טלפון">
                {crane.phone ? (
                  <a href={`tel:${crane.phone}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                    <Phone className="h-3 w-3" />
                    {crane.phone}
                  </a>
                ) : '—'}
              </Detail>
              <Detail label="ת.ז. לקוח">{crane.customerIdNumber ?? '—'}</Detail>
              <Detail label="מספר מדבקה">{crane.stickerNumber ?? '—'}</Detail>
              <Detail label="ת. התקנה">{fmt(crane.installDate)}</Detail>
              <Detail label="ת. פתיחה">{fmt(crane.openedDate)}</Detail>
              <Detail label="ת. ביטול">
                {crane.cancelledAt ? <span className="text-red-600">{fmt(crane.cancelledAt)}</span> : '—'}
              </Detail>
              <Detail label="תחילת אחריות">{fmt(crane.warrantyStart)}</Detail>
              <Detail label="תום אחריות">{fmt(crane.warrantyEnd)}</Detail>
              <Detail label="בדיקה הבאה">
                {status?.nextDueDate ? (
                  <span className={status.urgency === 'overdue' ? 'font-semibold text-red-600' : status.urgency === 'due_soon' ? 'font-semibold text-amber-600' : ''}>
                    {fmt(status.nextDueDate)}
                  </span>
                ) : <span className="text-muted-foreground">—</span>}
              </Detail>
            </dl>
          </div>

          {/* Inspections section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">היסטוריית בדיקות</h4>
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" />
                בדיקה חדשה
              </Button>
            </div>

            {isLoading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">טוען…</div>
            ) : inspections.length === 0 ? (
              <div className="rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">
                עוד לא הוזנה אף בדיקה למנוף הזה
              </div>
            ) : (
              <ul className="space-y-2">
                {inspections.map((ins) => (
                  <li key={ins.id} className="flex items-start justify-between gap-3 rounded-md border bg-card p-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-medium">{fmt(ins.inspectionDate)}</span>
                        <StatusBadge status={ins.status} />
                        {ins.technician && <span className="text-muted-foreground">· {ins.technician}</span>}
                        {ins.nextDueDate && (
                          <span className="text-xs text-muted-foreground">
                            (בדיקה הבאה: {fmt(ins.nextDueDate)})
                          </span>
                        )}
                      </div>
                      {(ins.result || ins.defects || ins.certificateNumber || ins.notes) && (
                        <div className="space-y-0.5 text-xs text-muted-foreground">
                          {ins.result && <div>תוצאה: {ins.result}</div>}
                          {ins.defects && <div>ליקויים: {ins.defects}</div>}
                          {ins.certificateNumber && <div>תעודה: {ins.certificateNumber}</div>}
                          {ins.notes && <div>הערות: {ins.notes}</div>}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm('למחוק את הבדיקה?')) deleteInspection.mutate(ins.id);
                      }}
                      title="מחק בדיקה"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <CreateInspectionDialog open={createOpen} onOpenChange={setCreateOpen} crane={crane} />
    </>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate">{children}</dd>
    </div>
  );
}

function StatusBadge({ status }: { status: InspectionStatus }) {
  const map: Record<InspectionStatus, string> = {
    planned: 'bg-slate-100 text-slate-700',
    scheduled: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    cancelled: 'bg-muted text-muted-foreground',
  };
  return <Badge className={`${map[status]} hover:${map[status]}`}>{INSPECTION_STATUS_LABEL[status]}</Badge>;
}

function fmt(iso: string | undefined | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
