import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ClipboardList, Loader2, Pencil, Plus, RotateCcw, User, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { OfficeTaskDialog } from '@/components/tasks/OfficeTaskDialog';
import { useOfficeTaskMutations, useOfficeTasks } from '@/hooks/useOfficeTasks';
import { canEditTask, dueLabel, dueState, filterTasks, sortTasks, type DueState, type OfficeTask, type TaskTab } from '@/lib/office-tasks';
import { localDateStr as toLocalDateStr } from '@/lib/visit-history';

const TZ = 'Asia/Jerusalem';
const when = (iso: string) => new Date(iso).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: TZ });

const DUE_CLASS: Record<DueState, string> = {
  overdue: 'border-red-300 bg-red-100 text-red-800',
  today: 'border-amber-300 bg-amber-100 text-amber-900',
  soon: 'border-slate-300 bg-slate-100 text-slate-700',
  later: 'border-slate-200 bg-white text-slate-600',
  none: '',
};

/**
 * ⭐ משימות למשרד (הרעיון של עידן, 08/10/2026): "מנהל פותח משימות לעובד,
 * והעובד מנהל אותן." שלוש לשוניות: שלי, פתחתי, כולם. ביקור אצל לקוח
 * נשאר עצירה ביומן; כאן רק מה שנעשה מהמשרד.
 *
 * 🔴 המסך הזה משותף: מנהל פותח במחשב אחד, העובד רואה במחשב אחר. לכן
 * השאילתה מתרעננת בחזרה לחלון וכל דקה (`useOfficeTasks`).
 */
export function TasksPage({ initialTab = 'mine' }: { initialTab?: TaskTab } = {}) {
  const tasks = useOfficeTasks();
  const { me, create, update, setStatus } = useOfficeTaskMutations();
  const [tab, setTab] = useState<TaskTab>(initialTab);
  const [showClosed, setShowClosed] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<OfficeTask | null>(null);
  const [closing, setClosing] = useState<OfficeTask | null>(null);
  const [closeNote, setCloseNote] = useState('');

  const today = toLocalDateStr(new Date());
  const all = useMemo(() => tasks.data ?? [], [tasks.data]);
  const list = useMemo(() => sortTasks(filterTasks(all, tab, me.id, showClosed), today), [all, tab, me.id, showClosed, today]);
  const counts = useMemo(() => ({
    mine: filterTasks(all, 'mine', me.id, false).length,
    created: filterTasks(all, 'created', me.id, false).length,
    all: filterTasks(all, 'all', me.id, false).length,
  }), [all, me.id]);

  const TABS: Array<{ id: TaskTab; label: string }> = [
    { id: 'mine', label: 'שלי' },
    { id: 'created', label: 'פתחתי' },
    { id: 'all', label: 'כל המשרד' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">משימות</h1>
          <p className="text-sm text-muted-foreground">מה פתוח אצל מי במשרד. ביקור אצל לקוח משבצים ביומן, לא כאן.</p>
        </div>
        <Button className="gap-1.5" onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4" />
          משימה חדשה
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex w-fit gap-1 rounded-xl border bg-slate-50 p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${tab === t.id ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground'}`}
            >
              {t.label}
              <span className={`rounded-full px-1.5 text-[11px] ${tab === t.id ? 'bg-primary/10 text-primary' : 'bg-slate-200'}`}>{counts[t.id]}</span>
            </button>
          ))}
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" className="accent-slate-700" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} />
          הצג גם סגורות (60 יום)
        </label>
      </div>

      {tasks.isLoading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> טוען משימות…</div>
      ) : tasks.isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">לא הצלחנו לטעון את המשימות. {tasks.error instanceof Error ? tasks.error.message : ''}</div>
      ) : list.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-white p-10 text-center text-sm text-muted-foreground">
          {tab === 'mine' ? 'אין לך משימות פתוחות.' : tab === 'created' ? 'לא פתחת משימות שעדיין פתוחות.' : 'אין משימות פתוחות במשרד.'}
        </div>
      ) : (
        <ul className="space-y-2">
          {list.map((t) => {
            const ds = dueState(t, today);
            const editable = canEditTask(t, me.id, me.role);
            const open = t.status === 'open';
            return (
              <li key={t.id} className={`rounded-xl border bg-white p-3 ${open ? (t.priority === 'high' ? 'border-red-200' : 'border-slate-200') : 'border-slate-200 opacity-70'}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`text-[15px] font-semibold text-slate-900 ${!open ? 'line-through' : ''}`}>{t.title}</span>
                      {t.priority === 'high' && open && <Badge variant="outline" className="border-red-300 bg-red-100 text-[10px] font-bold text-red-800">דחוף</Badge>}
                      {ds !== 'none' && <Badge variant="outline" className={`text-[10px] ${DUE_CLASS[ds]}`}>{dueLabel(ds, t.dueDate)}</Badge>}
                      {t.status === 'done' && <Badge variant="outline" className="border-emerald-300 bg-emerald-100 text-[10px] text-emerald-800">בוצע</Badge>}
                      {t.status === 'cancelled' && <Badge variant="outline" className="border-slate-300 bg-slate-100 text-[10px] text-slate-600">בוטל</Badge>}
                    </div>
                    {t.details && <div className="mt-0.5 whitespace-pre-line text-[13px] text-slate-700">{t.details}</div>}
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px] text-muted-foreground">
                      <span className="flex items-center gap-1"><User className="h-3 w-3" />{t.assigneeName}</span>
                      {t.customerName && (
                        <Link to={`/customer?q=${encodeURIComponent(t.customerNumber ?? t.customerName)}${t.customerNumber ? `&c=${encodeURIComponent(t.customerNumber)}` : ''}`} className="text-blue-700 hover:underline">
                          לקוח: {t.customerName}
                        </Link>
                      )}
                      <span>פתח {t.createdByName ?? ''} · <bdi>{when(t.createdAt)}</bdi></span>
                      {t.doneAt && <span>{t.status === 'done' ? 'בוצע' : 'בוטל'} {t.doneBy ?? ''} · <bdi>{when(t.doneAt)}</bdi>{t.doneNote ? ` · ${t.doneNote}` : ''}</span>}
                    </div>
                  </div>
                  {editable && (
                    <div className="flex shrink-0 items-center gap-1">
                      {open ? (
                        <>
                          <Button size="sm" className="h-8 gap-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => { setClosing(t); setCloseNote(''); }}>
                            <Check className="h-3.5 w-3.5" /> בוצע
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 w-8 p-0" title="עריכה" onClick={() => { setEditing(t); setDialogOpen(true); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 w-8 p-0 text-slate-500" title="ביטול המשימה" onClick={() => setStatus.mutate({ id: t.id, status: 'cancelled' })}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      ) : (
                        <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => setStatus.mutate({ id: t.id, status: 'open' })}>
                          <RotateCcw className="h-3.5 w-3.5" /> פתח מחדש
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <OfficeTaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={editing}
        busy={create.isPending || update.isPending}
        onSubmit={(input) => {
          if (editing) {
            update.mutate({ id: editing.id, patch: input }, { onSuccess: () => setDialogOpen(false) });
          } else {
            create.mutate(input, { onSuccess: () => setDialogOpen(false) });
          }
        }}
      />

      {/* סגירה עם הערה (לא חובה): מה נעשה בפועל. */}
      <Dialog open={!!closing} onOpenChange={(o) => !o && setClosing(null)}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader className="text-start">
            <DialogTitle className="flex items-center gap-2"><ClipboardList className="h-4 w-4 text-emerald-600" /> סימון כבוצע</DialogTitle>
            <DialogDescription className="text-start">{closing?.title}</DialogDescription>
          </DialogHeader>
          <Textarea value={closeNote} onChange={(e) => setCloseNote(e.target.value)} rows={3} placeholder="מה נעשה (לא חובה)" className="text-[16px] sm:text-sm" />
          <DialogFooter className="gap-2 sm:justify-start">
            <Button
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
              disabled={setStatus.isPending}
              onClick={() => {
                if (!closing) return;
                setStatus.mutate({ id: closing.id, status: 'done', note: closeNote }, { onSuccess: () => setClosing(null) });
              }}
            >
              {setStatus.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              בוצע
            </Button>
            <Button variant="outline" onClick={() => setClosing(null)}>ביטול</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
