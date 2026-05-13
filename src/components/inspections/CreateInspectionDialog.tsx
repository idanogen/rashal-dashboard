import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateInspection } from '@/hooks/useCraneInspections';
import type { Crane, InspectionStatus } from '@/types/crane';
import { INSPECTION_STATUS_LABEL } from '@/types/crane';

interface CreateInspectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  crane: Crane | null;
  /** Optional default inspection date (e.g., when scheduling for a specific day) */
  defaultInspectionDate?: string;
}

export function CreateInspectionDialog({
  open,
  onOpenChange,
  crane,
  defaultInspectionDate,
}: CreateInspectionDialogProps) {
  const create = useCreateInspection();
  const [inspectionDate, setInspectionDate] = useState(defaultInspectionDate ?? todayStr());
  const [status, setStatus] = useState<InspectionStatus>('planned');
  const [technician, setTechnician] = useState('');
  const [result, setResult] = useState('');
  const [defects, setDefects] = useState('');
  const [certificateNumber, setCertificateNumber] = useState('');
  const [notes, setNotes] = useState('');

  // Compute next-due (3 years from inspection date) so the user can override
  const [nextDueDate, setNextDueDate] = useState(addYears(inspectionDate, 3));

  function handleInspectionDateChange(v: string) {
    setInspectionDate(v);
    setNextDueDate(addYears(v, 3));
  }

  function reset() {
    setInspectionDate(defaultInspectionDate ?? todayStr());
    setStatus('planned');
    setTechnician('');
    setResult('');
    setDefects('');
    setCertificateNumber('');
    setNotes('');
    setNextDueDate(addYears(defaultInspectionDate ?? todayStr(), 3));
  }

  async function handleSubmit() {
    if (!crane) return;
    await create.mutateAsync({
      craneId: crane.id,
      inspectionDate,
      nextDueDate: nextDueDate || undefined,
      status,
      technician: technician || undefined,
      result: result || undefined,
      defects: defects || undefined,
      certificateNumber: certificateNumber || undefined,
      notes: notes || undefined,
    });
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>בדיקה חדשה</DialogTitle>
          {crane && (
            <DialogDescription>
              {crane.customerName ?? '—'} · מס' {crane.deviceNumber} · {crane.model}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ci-date">תאריך בדיקה</Label>
            <Input
              id="ci-date"
              type="date"
              value={inspectionDate}
              onChange={(e) => handleInspectionDateChange(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ci-next">תאריך בדיקה הבאה</Label>
            <Input
              id="ci-next"
              type="date"
              value={nextDueDate}
              onChange={(e) => setNextDueDate(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ci-status">סטטוס</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as InspectionStatus)}>
              <SelectTrigger id="ci-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(INSPECTION_STATUS_LABEL) as InspectionStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{INSPECTION_STATUS_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ci-tech">בודק</Label>
            <Input id="ci-tech" value={technician} onChange={(e) => setTechnician(e.target.value)} placeholder="שם הבודק" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ci-result">תוצאה</Label>
            <Input id="ci-result" value={result} onChange={(e) => setResult(e.target.value)} placeholder="תקין / נדרשים תיקונים / לא תקין" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ci-cert">מספר תעודה</Label>
            <Input id="ci-cert" value={certificateNumber} onChange={(e) => setCertificateNumber(e.target.value)} />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ci-defects">ליקויים</Label>
            <Input id="ci-defects" value={defects} onChange={(e) => setDefects(e.target.value)} />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ci-notes">הערות</Label>
            <Input id="ci-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={create.isPending}>
            ביטול
          </Button>
          <Button onClick={handleSubmit} disabled={create.isPending || !crane}>
            {create.isPending ? 'שומר…' : 'שמור בדיקה'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addYears(iso: string, years: number): string {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return '';
  d.setFullYear(d.getFullYear() + years);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
