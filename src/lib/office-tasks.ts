/**
 * משימות למשרד (08/10/2026): הלוגיקה הטהורה, בלי ייבוא, נבדקת ב-test/.
 *
 * "מנהל פותח משימה לעובד, והעובד מנהל אותה." מה שכאן קובע מה "שלי",
 * מה באיחור, ואיך הרשימה מסודרת, כדי שהמסך לא ימציא את זה בעצמו.
 */

export type OfficeTaskStatus = 'open' | 'done' | 'cancelled';
export type OfficeTaskPriority = 'normal' | 'high';

export interface OfficeTask {
  id: string;
  title: string;
  details: string | null;
  customerNumber: string | null;
  customerName: string | null;
  assigneeId: string;
  assigneeName: string;
  createdBy: string | null;
  createdByName: string | null;
  dueDate: string | null;
  priority: OfficeTaskPriority;
  status: OfficeTaskStatus;
  doneAt: string | null;
  doneBy: string | null;
  doneNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OfficeTaskRow {
  id: string;
  title: string;
  details: string | null;
  customer_number: string | null;
  customer_name: string | null;
  assignee_id: string;
  assignee_name: string;
  created_by: string | null;
  created_by_name: string | null;
  due_date: string | null;
  priority: string;
  status: string;
  done_at: string | null;
  done_by: string | null;
  done_note: string | null;
  created_at: string;
  updated_at: string;
}

export function rowToTask(r: OfficeTaskRow): OfficeTask {
  return {
    id: r.id,
    title: r.title,
    details: r.details ?? null,
    customerNumber: r.customer_number ?? null,
    customerName: r.customer_name ?? null,
    assigneeId: r.assignee_id,
    assigneeName: r.assignee_name,
    createdBy: r.created_by ?? null,
    createdByName: r.created_by_name ?? null,
    dueDate: r.due_date ?? null,
    priority: r.priority === 'high' ? 'high' : 'normal',
    status: r.status === 'done' ? 'done' : r.status === 'cancelled' ? 'cancelled' : 'open',
    doneAt: r.done_at ?? null,
    doneBy: r.done_by ?? null,
    doneNote: r.done_note ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export type DueState = 'overdue' | 'today' | 'soon' | 'later' | 'none';

/** מצב היעד מול היום (YYYY-MM-DD מקומי). "בקרוב" = עד שלושה ימים. */
export function dueState(task: Pick<OfficeTask, 'dueDate' | 'status'>, today: string): DueState {
  if (!task.dueDate || task.status !== 'open') return 'none';
  if (task.dueDate < today) return 'overdue';
  if (task.dueDate === today) return 'today';
  const diff = (Date.parse(`${task.dueDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000;
  return diff <= 3 ? 'soon' : 'later';
}

export function dueLabel(state: DueState, dueDate: string | null): string {
  if (!dueDate || state === 'none') return '';
  const [y, m, d] = dueDate.split('-');
  const short = `${Number(d)}.${Number(m)}`;
  void y;
  switch (state) {
    case 'overdue': return `באיחור · ${short}`;
    case 'today': return 'היום';
    case 'soon': return `עד ${short}`;
    default: return short;
  }
}

export type TaskTab = 'mine' | 'created' | 'all';

/**
 * מה נכנס ללשונית. "שלי" = משובץ עליי. "פתחתי" = אני פתחתי לאחרים.
 * "הכל" = כל המשרד. סגורות מוצגות רק כשמבקשים.
 */
export function filterTasks(tasks: OfficeTask[], tab: TaskTab, me: string, showClosed: boolean): OfficeTask[] {
  return tasks.filter((t) => {
    if (!showClosed && t.status !== 'open') return false;
    if (tab === 'mine') return t.assigneeId === me;
    if (tab === 'created') return t.createdBy === me;
    return true;
  });
}

const DUE_RANK: Record<DueState, number> = { overdue: 0, today: 1, soon: 2, later: 3, none: 4 };

/**
 * פתוחות לפני סגורות; בפתוחות: דחוף לפני רגיל, ואז לפי היעד (באיחור קודם),
 * ואז הישנה קודם. סגורות: האחרונה שנסגרה למעלה.
 */
export function sortTasks(tasks: OfficeTask[], today: string): OfficeTask[] {
  return [...tasks].sort((a, b) => {
    const ao = a.status === 'open' ? 0 : 1;
    const bo = b.status === 'open' ? 0 : 1;
    if (ao !== bo) return ao - bo;
    if (ao === 1) return (b.doneAt ?? b.updatedAt).localeCompare(a.doneAt ?? a.updatedAt);
    if (a.priority !== b.priority) return a.priority === 'high' ? -1 : 1;
    const ad = DUE_RANK[dueState(a, today)];
    const bd = DUE_RANK[dueState(b, today)];
    if (ad !== bd) return ad - bd;
    if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    return a.createdAt.localeCompare(b.createdAt);
  });
}

/** מונה לתפריט: כמה פתוחות עליי, וכמה מהן באיחור. */
export function myOpenCounts(tasks: OfficeTask[], me: string, today: string): { open: number; overdue: number } {
  const mine = tasks.filter((t) => t.status === 'open' && t.assigneeId === me);
  return { open: mine.length, overdue: mine.filter((t) => dueState(t, today) === 'overdue').length };
}

/** מי רשאי לסגור או לערוך: המבצע, הפותח, או מנהל. זהה למדיניות במסד. */
export function canEditTask(task: OfficeTask, me: string, role: string | undefined): boolean {
  if (task.assigneeId === me || task.createdBy === me) return true;
  return role === 'admin' || role === 'team_manager' || role === 'management' || role === 'dispatcher';
}

/** מחר, ואם מחר שישי או שבת, יום ראשון. חישוב מקומי. */
export function nextWorkday(from: Date): string {
  const d = new Date(from);
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 5 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
