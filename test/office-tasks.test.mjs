import test from 'node:test';
import assert from 'node:assert/strict';
import { rowToTask, dueState, dueLabel, filterTasks, sortTasks, myOpenCounts, canEditTask, nextWorkday } from '../src/lib/office-tasks.ts';

const base = (o) => rowToTask({
  id: o.id, title: o.title ?? 'משימה', details: null, customer_number: null, customer_name: null,
  assignee_id: o.assignee ?? 'u1', assignee_name: 'אילונה', created_by: o.by ?? 'm1', created_by_name: 'עמי',
  due_date: o.due ?? null, priority: o.priority ?? 'normal', status: o.status ?? 'open',
  done_at: o.doneAt ?? null, done_by: null, done_note: null, created_at: o.created ?? '2026-10-01T08:00:00Z', updated_at: o.created ?? '2026-10-01T08:00:00Z',
});
const TODAY = '2026-10-08';

test('מצב היעד: באיחור, היום, בקרוב, מאוחר, ובלי יעד', () => {
  assert.equal(dueState(base({ id: 'a', due: '2026-10-07' }), TODAY), 'overdue');
  assert.equal(dueState(base({ id: 'b', due: '2026-10-08' }), TODAY), 'today');
  assert.equal(dueState(base({ id: 'c', due: '2026-10-11' }), TODAY), 'soon');
  assert.equal(dueState(base({ id: 'd', due: '2026-10-20' }), TODAY), 'later');
  assert.equal(dueState(base({ id: 'e' }), TODAY), 'none');
  // סגורה באיחור אינה "באיחור"
  assert.equal(dueState(base({ id: 'f', due: '2026-10-01', status: 'done' }), TODAY), 'none');
  assert.equal(dueLabel('overdue', '2026-10-07'), 'באיחור · 7.10');
  assert.equal(dueLabel('today', '2026-10-08'), 'היום');
  assert.equal(dueLabel('none', null), '');
});

test('לשוניות: שלי, פתחתי, הכל, וסגורות רק כשמבקשים', () => {
  const tasks = [
    base({ id: '1', assignee: 'u1', by: 'm1' }),
    base({ id: '2', assignee: 'u2', by: 'u1' }),
    base({ id: '3', assignee: 'u1', by: 'm1', status: 'done' }),
  ];
  assert.deepEqual(filterTasks(tasks, 'mine', 'u1', false).map((t) => t.id), ['1']);
  assert.deepEqual(filterTasks(tasks, 'mine', 'u1', true).map((t) => t.id), ['1', '3']);
  assert.deepEqual(filterTasks(tasks, 'created', 'u1', false).map((t) => t.id), ['2']);
  assert.deepEqual(filterTasks(tasks, 'all', 'u1', false).map((t) => t.id), ['1', '2']);
});

test('מיון: פתוחות קודם, דחוף קודם, באיחור קודם, ישנה קודם; סגורות לפי סגירה', () => {
  const tasks = [
    base({ id: 'later', due: '2026-10-20', created: '2026-10-01T08:00:00Z' }),
    base({ id: 'done-old', status: 'done', doneAt: '2026-10-02T08:00:00Z' }),
    base({ id: 'overdue', due: '2026-10-05', created: '2026-10-03T08:00:00Z' }),
    base({ id: 'high-nodue', priority: 'high', created: '2026-10-04T08:00:00Z' }),
    base({ id: 'done-new', status: 'done', doneAt: '2026-10-07T08:00:00Z' }),
    base({ id: 'today', due: '2026-10-08', created: '2026-10-02T08:00:00Z' }),
    base({ id: 'nodue-old', created: '2026-09-30T08:00:00Z' }),
  ];
  assert.deepEqual(sortTasks(tasks, TODAY).map((t) => t.id), ['high-nodue', 'overdue', 'today', 'later', 'nodue-old', 'done-new', 'done-old']);
});

test('מונה לתפריט והרשאת עריכה', () => {
  const tasks = [
    base({ id: '1', assignee: 'u1', due: '2026-10-01' }),
    base({ id: '2', assignee: 'u1' }),
    base({ id: '3', assignee: 'u2' }),
    base({ id: '4', assignee: 'u1', status: 'done' }),
  ];
  assert.deepEqual(myOpenCounts(tasks, 'u1', TODAY), { open: 2, overdue: 1 });
  assert.equal(canEditTask(tasks[2], 'u1', 'viewer'), false);
  assert.equal(canEditTask(tasks[2], 'u2', 'viewer'), true);
  assert.equal(canEditTask(tasks[2], 'm1', 'viewer'), true);
  assert.equal(canEditTask(tasks[2], 'x', 'team_manager'), true);
  assert.equal(canEditTask(tasks[2], 'x', 'management'), true);
});

test('יום העבודה הבא מדלג על שישי ושבת', () => {
  assert.equal(nextWorkday(new Date(2026, 9, 7)), '2026-10-08'); // רביעי → חמישי
  assert.equal(nextWorkday(new Date(2026, 9, 8)), '2026-10-11'); // חמישי → ראשון
  assert.equal(nextWorkday(new Date(2026, 9, 9)), '2026-10-11'); // שישי → ראשון
});
