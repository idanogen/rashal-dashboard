/**
 * צ'אט צוות (09/10/2026): הלוגיקה הטהורה, בלי ייבוא, נבדקת ב-test/.
 * אותו קובץ מועתק לאפליקציה (`rashal-driver/src/lib/staff-chat.ts`).
 */

export interface StaffMessage {
  id: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  recipientName: string;
  body: string;
  createdAt: string;
  readAt: string | null;
}

export interface StaffMessageRow {
  id: string;
  sender_id: string;
  sender_name: string;
  recipient_id: string;
  recipient_name: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

export function rowToMessage(r: StaffMessageRow): StaffMessage {
  return {
    id: r.id, senderId: r.sender_id, senderName: r.sender_name, recipientId: r.recipient_id,
    recipientName: r.recipient_name, body: r.body, createdAt: r.created_at, readAt: r.read_at ?? null,
  };
}

export interface StaffPerson {
  id: string;
  name: string;
  role: string;
  /** נהג: שם המשובץ בצוות השטח, כדי שהמשרד יזהה אותו. */
  linkedDriver?: string | null;
}

export interface StaffConversation {
  peer: StaffPerson;
  lastMessage: StaffMessage | null;
  unread: number;
}

export const ROLE_SHORT: Record<string, string> = {
  admin: 'מנהל מערכת', management: 'הנהלה', team_manager: 'מנהל צוות',
  dispatcher: 'סדרן', driver: 'נהג', viewer: 'משרד',
};

/** מי הצד השני בהודעה, מנקודת המבט שלי. */
export function peerOf(m: StaffMessage, me: string): string {
  return m.senderId === me ? m.recipientId : m.senderId;
}

/**
 * רשימת האנשים לשיחה: כל הפעילים חוץ ממני, עם ההודעה האחרונה וכמה לא נקראו.
 * ⭐ המיון: מי שיש ממנו לא-נקרא למעלה, אחר כך לפי ההודעה האחרונה, ואז לפי שם.
 * אדם שמעולם לא דיברתי איתו עדיין ברשימה, כי אחרת אי אפשר להתחיל שיחה.
 */
export function buildConversations(people: StaffPerson[], messages: StaffMessage[], me: string): StaffConversation[] {
  const last = new Map<string, StaffMessage>();
  const unread = new Map<string, number>();
  for (const m of messages) {
    const peer = peerOf(m, me);
    const prev = last.get(peer);
    if (!prev || m.createdAt > prev.createdAt) last.set(peer, m);
    if (m.recipientId === me && !m.readAt) unread.set(peer, (unread.get(peer) ?? 0) + 1);
  }
  return people
    .filter((p) => p.id !== me)
    .map((p) => ({ peer: p, lastMessage: last.get(p.id) ?? null, unread: unread.get(p.id) ?? 0 }))
    .sort((a, b) => {
      if ((a.unread > 0) !== (b.unread > 0)) return a.unread > 0 ? -1 : 1;
      const at = a.lastMessage?.createdAt ?? '';
      const bt = b.lastMessage?.createdAt ?? '';
      if (at !== bt) return bt.localeCompare(at);
      return a.peer.name.localeCompare(b.peer.name, 'he');
    });
}

/** ההודעות ביני לבין אדם אחד, מהישנה לחדשה. */
export function threadWith(messages: StaffMessage[], me: string, peer: string): StaffMessage[] {
  return messages
    .filter((m) => (m.senderId === me && m.recipientId === peer) || (m.senderId === peer && m.recipientId === me))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function totalUnread(messages: StaffMessage[], me: string): number {
  return messages.filter((m) => m.recipientId === me && !m.readAt).length;
}

/** שם לתצוגה של פרופיל: שם מלא, אחרת שם משתמש, ולנהג השם מהצוות. */
export function displayName(p: { fullName?: string | null; username?: string | null; linkedDriver?: string | null; email?: string | null }): string {
  return p.fullName?.trim() || p.linkedDriver?.trim() || p.username?.trim() || p.email || 'עובד';
}

/** כותרת וגוף להתראת דפדפן. גוף קצר: הודעה ארוכה נחתכת. */
export function notificationText(m: StaffMessage): { title: string; body: string } {
  return { title: `הודעה מ${m.senderName}`, body: m.body.length > 120 ? `${m.body.slice(0, 117)}…` : m.body };
}

// ─── סדר ונעיצה (עידן, 09/10/2026) ──────────────────────────────────────
export interface StaffListPrefs {
  pinned: string[];
  sortOrder: string[];
}

export const EMPTY_PREFS: StaffListPrefs = { pinned: [], sortOrder: [] };

/**
 * מחיל את ההעדפות על הרשימה: נעוצים למעלה (בסדר הנעיצה), אחריהם מי שסודר
 * ביד (בסדר שנקבע), ובסוף השאר בסדר ברירת המחדל (לא-נקרא קודם). ככה מי
 * שלא נגע בכלום רואה בדיוק את מה שראה עד היום.
 */
export function applyPrefs(convs: StaffConversation[], prefs: StaffListPrefs): StaffConversation[] {
  const byId = new Map(convs.map((c) => [c.peer.id, c]));
  const out: StaffConversation[] = [];
  const seen = new Set<string>();
  for (const id of prefs.pinned) {
    const c = byId.get(id);
    if (c && !seen.has(id)) { out.push(c); seen.add(id); }
  }
  for (const id of prefs.sortOrder) {
    const c = byId.get(id);
    if (c && !seen.has(id)) { out.push(c); seen.add(id); }
  }
  for (const c of convs) if (!seen.has(c.peer.id)) out.push(c);
  return out;
}

export function togglePinned(prefs: StaffListPrefs, id: string): StaffListPrefs {
  const pinned = prefs.pinned.includes(id) ? prefs.pinned.filter((x) => x !== id) : [...prefs.pinned, id];
  return { ...prefs, pinned };
}

/**
 * גרירה: הפריט `activeId` עובר למקום של `overId` ברשימה המוצגת. הסדר החדש
 * נשמר במלואו (כל הלא-נעוצים), כדי שהגרירה תיראה בדיוק כמו שהעובד עשה אותה.
 * גרירה בין נעוץ ללא-נעוץ משנה את סדר הנעוצים או את סדר השאר, לא את הנעיצה.
 */
export function reorderPrefs(prefs: StaffListPrefs, shown: string[], activeId: string, overId: string): StaffListPrefs {
  if (activeId === overId) return prefs;
  const isPinned = (id: string) => prefs.pinned.includes(id);
  if (isPinned(activeId) !== isPinned(overId)) return prefs;
  const group = shown.filter((id) => isPinned(id) === isPinned(activeId));
  const from = group.indexOf(activeId);
  const to = group.indexOf(overId);
  if (from < 0 || to < 0) return prefs;
  const next = [...group];
  next.splice(from, 1);
  next.splice(to, 0, activeId);
  return isPinned(activeId) ? { ...prefs, pinned: next } : { ...prefs, sortOrder: next };
}
