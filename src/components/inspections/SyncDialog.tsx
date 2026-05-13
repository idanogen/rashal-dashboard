import { useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react';
import { parseCraneExcel } from '@/lib/crane-excel-parser';
import { diffAgainstExisting, type SyncDiff } from '@/lib/crane-sync';
import { useApplySync } from '@/hooks/useCraneSync';
import { useCranes } from '@/hooks/useCranes';

interface SyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SyncDialog({ open, onOpenChange }: SyncDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: cranes = [] } = useCranes();
  const apply = useApplySync();

  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [rowCount, setRowCount] = useState(0);
  const [diff, setDiff] = useState<SyncDiff | null>(null);

  function reset() {
    setFilename(null);
    setRowCount(0);
    setDiff(null);
    setParseError(null);
    setParsing(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFilename(file.name);
    setParseError(null);
    setDiff(null);
    setParsing(true);
    try {
      const parsed = await parseCraneExcel(file);
      setRowCount(parsed.length);
      const d = diffAgainstExisting(cranes, parsed);
      setDiff(d);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'שגיאה לא ידועה');
    } finally {
      setParsing(false);
    }
  }

  async function handleApply() {
    if (!diff || !filename) return;
    await apply.mutateAsync({
      diff,
      meta: { sourceFilename: filename, totalRowsInFile: rowCount },
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
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>סנכרון דוח מנופים</DialogTitle>
          <DialogDescription>
            העלאת קובץ Excel מעודכן. המערכת תזהה אוטומטית מנופים חדשים, עדכונים, ומנופים שנעלמו מהקובץ.
          </DialogDescription>
        </DialogHeader>

        {!filename ? (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 p-10 text-center text-sm text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
          >
            <Upload className="h-8 w-8" />
            <div>לחץ כדי לבחור קובץ Excel</div>
            <div className="text-xs">או גרור לכאן (.xlsx)</div>
          </button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-md border bg-muted/20 p-3 text-sm">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{filename}</div>
                {!parsing && !parseError && (
                  <div className="text-xs text-muted-foreground">{rowCount.toLocaleString('he-IL')} שורות נקראו</div>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={reset}>החלף קובץ</Button>
            </div>

            {parsing && (
              <div className="rounded-md bg-muted/20 p-3 text-sm text-muted-foreground">מנתח קובץ…</div>
            )}

            {parseError && (
              <div className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-800">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>{parseError}</div>
              </div>
            )}

            {diff && <DiffPreview diff={diff} />}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFile}
          className="hidden"
        />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={apply.isPending}>
            {diff ? 'ביטול' : 'סגור'}
          </Button>
          <Button onClick={handleApply} disabled={!diff || apply.isPending || parsing}>
            {apply.isPending ? 'מסנכרן…' : 'אישור וסנכרון'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DiffPreview({ diff }: { diff: SyncDiff }) {
  const noChanges =
    diff.newCranes.length === 0 &&
    diff.updates.length === 0 &&
    diff.missingInFile.length === 0;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatBox label="חדשים" value={diff.newCranes.length} tone="green" />
        <StatBox label="עודכנו" value={diff.updates.length} tone="amber" />
        <StatBox label="ללא שינוי" value={diff.unchanged} tone="slate" />
        <StatBox label="חסרים בקובץ" value={diff.missingInFile.length} tone="muted" />
      </div>

      {noChanges && (
        <div className="flex items-center gap-2 rounded-md bg-green-50 p-3 text-sm text-green-800">
          <CheckCircle2 className="h-4 w-4" />
          הקובץ זהה למידע הקיים — אין מה לסנכרן
        </div>
      )}

      {diff.newCranes.length > 0 && (
        <Section title={`מנופים חדשים (${diff.newCranes.length})`}>
          <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
            {diff.newCranes.slice(0, 50).map((r) => (
              <li key={r.deviceNumber} className="flex gap-2">
                <span className="font-mono text-muted-foreground">{r.deviceNumber}</span>
                <span>{r.customerName ?? '—'}</span>
                <span className="text-muted-foreground">· {r.model}</span>
              </li>
            ))}
            {diff.newCranes.length > 50 && (
              <li className="text-muted-foreground">…ועוד {diff.newCranes.length - 50}</li>
            )}
          </ul>
        </Section>
      )}

      {diff.updates.length > 0 && (
        <Section title={`עדכונים (${diff.updates.length})`}>
          <ul className="max-h-48 space-y-2 overflow-y-auto text-xs">
            {diff.updates.slice(0, 30).map((u) => (
              <li key={u.crane.id} className="rounded border bg-muted/10 p-2">
                <div className="font-medium">
                  {u.crane.customerName ?? '—'}
                  <span className="mr-2 font-mono text-muted-foreground">{u.crane.deviceNumber}</span>
                </div>
                <ul className="mt-1 space-y-0.5">
                  {u.changes.map((c) => (
                    <li key={c.field} className="text-muted-foreground">
                      <span className="font-medium">{fieldLabel(c.field)}:</span>{' '}
                      <span className="line-through opacity-60">{c.before || '—'}</span>{' '}
                      <span className="text-foreground">→ {c.after || '—'}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
            {diff.updates.length > 30 && (
              <li className="text-muted-foreground">…ועוד {diff.updates.length - 30}</li>
            )}
          </ul>
        </Section>
      )}

      {diff.missingInFile.length > 0 && (
        <Section title={`חסרים בקובץ החדש (${diff.missingInFile.length})`}>
          <div className="text-xs text-muted-foreground">
            מנופים שקיימים במערכת אבל לא הופיעו בקובץ. נשארים במערכת כפי שהם — לבדיקה ידנית אם הוסרו.
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2 rounded-md border p-3">
      <h5 className="text-sm font-semibold">{title}</h5>
      {children}
    </div>
  );
}

function StatBox({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'green' | 'amber' | 'slate' | 'muted';
}) {
  const styles =
    tone === 'green'
      ? 'bg-green-50 text-green-800'
      : tone === 'amber'
      ? 'bg-amber-50 text-amber-800'
      : tone === 'slate'
      ? 'bg-slate-50 text-slate-700'
      : 'bg-muted/40 text-muted-foreground';
  return (
    <div className={`rounded-md p-3 text-center ${styles}`}>
      <div className="text-2xl font-bold">{value.toLocaleString('he-IL')}</div>
      <div className="text-xs">{label}</div>
    </div>
  );
}

function fieldLabel(f: string): string {
  const map: Record<string, string> = {
    model: 'דגם',
    customerIdNumber: 'ת.ז. לקוח',
    customerName: 'שם לקוח',
    customerType: 'סוג לקוח',
    customerTypeCode: 'קוד סוג',
    phone: 'טלפון',
    stickerNumber: 'מספר מדבקה',
    installDate: 'ת. התקנה',
    openedDate: 'ת. פתיחה',
    warrantyStart: 'תחילת אחריות',
    warrantyEnd: 'תום אחריות',
    cancelledAt: 'ת. ביטול',
  };
  return map[f] ?? f;
}
