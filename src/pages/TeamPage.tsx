import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Truck, Wrench, UserPlus, Loader2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAssignees, ASSIGNEES_QUERY_KEY } from '@/hooks/useAssignees';
import { createAssignee, updateAssignee } from '@/lib/assignees';
import {
  KIND_LABELS,
  PALETTE_KEYS,
  nextFreeColor,
  styleForColor,
  type Assignee,
  type AssigneeColor,
  type AssigneeKind,
} from '@/types/assignee';
import { cn } from '@/lib/utils';

/**
 * מסך צוות השטח.
 *
 * 🔴 **הבעיה שהוא סוגר (עמי, 23/08/2026):** הוספת נהג או טכנאי הייתה
 * שינוי קוד ופריסה שלנו. עכשיו זה טופס, והשם מופיע בבוררי השיבוץ מיד.
 *
 * ⭐ **ואין כאן מחיקה בכוונה.** השם הוא המפתח שכל העצירות ההיסטוריות
 * מחזיקות. מי שעזב מסומן לא פעיל: הוא יורד מכל בוררי השיבוץ, וכל
 * ההיסטוריה שלו נשארת קריאה.
 */
export function TeamPage() {
  const qc = useQueryClient();
  const { all, isLoading } = useAssignees();
  const [createOpen, setCreateOpen] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ASSIGNEES_QUERY_KEY });

  const patch = useMutation({
    mutationFn: (v: { name: string; fields: Parameters<typeof updateAssignee>[1] }) =>
      updateAssignee(v.name, v.fields),
    onSuccess: () => {
      refresh();
      toast.success('נשמר');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const active = all.filter((a) => a.active);
  const inactive = all.filter((a) => !a.active);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <Users className="h-5 w-5 text-primary" />
            צוות השטח
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            נהגי חלוקה וטכנאי שירות. מי שמופיע כאן כפעיל מופיע בכל בוררי השיבוץ.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <UserPlus className="ms-1 h-4 w-4" />
          הוספת עובד
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <TeamTable rows={active} onPatch={patch.mutate} busy={patch.isPending} />

          {inactive.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground">
                לא פעילים ({inactive.length})
              </h2>
              <p className="text-xs text-muted-foreground">
                לא מופיעים בשיבוץ. השיבוצים הישנים שלהם נשמרו במלואם.
              </p>
              <TeamTable rows={inactive} onPatch={patch.mutate} busy={patch.isPending} />
            </div>
          )}
        </>
      )}

      <CreateAssigneeDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        existing={all}
        onCreated={refresh}
      />
    </div>
  );
}

interface TableProps {
  rows: Assignee[];
  onPatch: (v: { name: string; fields: Parameters<typeof updateAssignee>[1] }) => void;
  busy: boolean;
}

function TeamTable({ rows, onPatch, busy }: TableProps) {
  if (rows.length === 0) {
    return <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">אין רשומות</p>;
  }
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>שם</TableHead>
            <TableHead>תפקיד בשטח</TableHead>
            <TableHead>טלפון</TableHead>
            <TableHead>צבע ביומן</TableHead>
            <TableHead className="text-end">פעיל</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((a) => {
            const style = styleForColor(a.color, a.name);
            return (
              <TableRow key={a.name} className={a.active ? '' : 'opacity-60'}>
                <TableCell>
                  <span className={cn('inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-sm font-semibold', style.color)}>
                    {a.kind === 'technician' ? <Wrench className="h-3.5 w-3.5" /> : <Truck className="h-3.5 w-3.5" />}
                    {a.name}
                  </span>
                </TableCell>
                <TableCell>
                  <Select
                    value={a.kind}
                    onValueChange={(v) => onPatch({ name: a.name, fields: { kind: v as AssigneeKind } })}
                    disabled={busy}
                  >
                    <SelectTrigger className="h-8 w-40">
                      <SelectValue>{KIND_LABELS[a.kind]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(KIND_LABELS) as AssigneeKind[]).map((k) => (
                        <SelectItem key={k} value={k}>{KIND_LABELS[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <PhoneCell value={a.phone ?? ''} busy={busy} onSave={(phone) => onPatch({ name: a.name, fields: { phone } })} />
                </TableCell>
                <TableCell>
                  <ColorPicker value={a.color} busy={busy} onChange={(color) => onPatch({ name: a.name, fields: { color } })} />
                </TableCell>
                <TableCell className="text-end">
                  <Button
                    size="sm"
                    variant={a.active ? 'outline' : 'default'}
                    disabled={busy}
                    onClick={() => onPatch({ name: a.name, fields: { active: !a.active } })}
                  >
                    {a.active ? 'סמן כעזב' : 'החזרה לפעילות'}
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

/** שמירה ביציאה מהשדה בלבד, כדי שלא תיווצר כתיבה לכל תו. */
function PhoneCell({ value, busy, onSave }: { value: string; busy: boolean; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  return (
    <Input
      className="h-8 w-36"
      dir="ltr"
      value={draft}
      disabled={busy}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft.trim() !== (value ?? '').trim() && onSave(draft)}
      placeholder="050-0000000"
    />
  );
}

/**
 * עיגול אחד שפותח פלטה.
 *
 * 🔴 בגרסה הראשונה שלוש-עשרה נקודות הצבע ישבו בכל שורה, והן הציפו את
 * הטבלה: העמודה החשובה (מי בצוות ומה תפקידו) התכווצה לטובת בחירה שנוגעים
 * בה פעם בחצי שנה. נראה בצילום לפני המסירה.
 */
function ColorPicker({ value, busy, onChange }: { value: AssigneeColor; busy: boolean; onChange: (c: AssigneeColor) => void }) {
  const current = styleForColor(value, value);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={busy}
          title="שינוי צבע"
          className={cn(
            'h-6 w-6 rounded-full ring-1 ring-border transition-transform hover:scale-110',
            current.badgeColor,
          )}
        />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        <div className="grid grid-cols-7 gap-1.5">
          {PALETTE_KEYS.map((c) => {
            const s = styleForColor(c, c);
            return (
              <button
                key={c}
                type="button"
                disabled={busy}
                title={c}
                onClick={() => onChange(c)}
                className={cn(
                  'h-6 w-6 rounded-full transition-transform',
                  s.badgeColor,
                  value === c ? 'ring-2 ring-offset-1 ring-foreground scale-110' : 'hover:scale-110',
                )}
              />
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function CreateAssigneeDialog({
  open,
  onOpenChange,
  existing,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existing: Assignee[];
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<AssigneeKind>('driver');
  const [phone, setPhone] = useState('');

  const color = useMemo(() => nextFreeColor(existing.map((a) => a.color)), [existing]);
  const trimmed = name.trim();
  // 🔴 השם הוא המפתח, ולכן כפילות אינה "עוד שורה" אלא כתיבה על עובד קיים.
  const duplicate = existing.some((a) => a.name === trimmed);

  const create = useMutation({
    mutationFn: () => createAssignee({ name: trimmed, kind, phone, color }),
    onSuccess: () => {
      toast.success(`${trimmed} נוסף לצוות`);
      onCreated();
      onOpenChange(false);
      setName('');
      setPhone('');
      setKind('driver');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>הוספת עובד לצוות השטח</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="team-name" className="text-xs">שם</Label>
            <Input id="team-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="השם כפי שיופיע ביומן" />
            {duplicate && <p className="text-xs text-destructive">השם הזה כבר קיים ברשימה.</p>}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">תפקיד בשטח</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as AssigneeKind)}>
              <SelectTrigger className="h-9">
                <SelectValue>{KIND_LABELS[kind]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(KIND_LABELS) as AssigneeKind[]).map((k) => (
                  <SelectItem key={k} value={k}>{KIND_LABELS[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="team-phone" className="text-xs">טלפון</Label>
            <Input id="team-phone" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="050-0000000" />
          </div>

          <p className="rounded-md border bg-muted/40 p-2 text-xs text-muted-foreground">
            הוספה כאן פותחת שיבוץ בלבד. כדי שהעובד גם יתחבר לאפליקציה, צריך לפתוח לו
            משתמש במסך המשתמשים ולקשר אותו לשם הזה.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>ביטול</Button>
          <Button disabled={!trimmed || duplicate || create.isPending} onClick={() => create.mutate()}>
            {create.isPending && <Loader2 className="ms-1 h-4 w-4 animate-spin" />}
            הוספה
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
