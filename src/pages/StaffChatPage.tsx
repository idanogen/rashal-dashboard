import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bell, GripVertical, Loader2, MessageSquare, Pin, PinOff, Send, Smile } from 'lucide-react';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { EMOJI_GROUPS, insertAt, isEmojiOnly } from '@/lib/emoji';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useStaffChatActions, useStaffMessages, useStaffPeople, useStaffPrefs } from '@/hooks/useStaffChat';
import { applyPrefs, buildConversations, reorderPrefs, threadWith, togglePinned, ROLE_SHORT, type StaffConversation, type StaffMessage, type StaffPerson } from '@/lib/staff-chat';

const TZ = 'Asia/Jerusalem';
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
const ddmm = (iso: string) => new Date(iso).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', timeZone: TZ });
const dayKey = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ });

/**
 * ⭐ צ'אט צוות (הרעיון של עידן, 09/10/2026): הודעה ישירה מעובד לעובד בתוך
 * המערכת, במקום הוואטסאפ הפרטי. שכבה דקה לצד הצ'אט על פריטי העבודה.
 *
 * הרשימה מימין (אנשים, עם מונה לא-נקרא), השרשור משמאל. נהג מקבל את ההודעה
 * באפליקציה (זמן אמת כשהיא פתוחה; דחיפה דרך התור הקיים כשיהיה Firebase).
 */
export function StaffChatPage() {
  const [params, setParams] = useSearchParams();
  const messages = useStaffMessages();
  const people = useStaffPeople();
  const { me, send, markRead } = useStaffChatActions();
  const [draft, setDraft] = useState('');
  const [filter, setFilter] = useState('');
  const [notifPerm, setNotifPerm] = useState<NotificationPermission | 'unsupported'>(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  );
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);

  const selectedId = params.get('to');
  // סדר ונעיצה לכל עובד (09/10/2026): נעוצים למעלה, אחריהם הסדר הידני, אחר כך ברירת המחדל.
  const { prefs, save: savePrefs } = useStaffPrefs();
  const convs = useMemo(
    () => applyPrefs(buildConversations(people.data ?? [], messages.data ?? [], me.id), prefs),
    [people.data, messages.data, me.id, prefs],
  );
  const visible = useMemo(() => {
    const f = filter.trim();
    return f ? convs.filter((c) => c.peer.name.includes(f)) : convs;
  }, [convs, filter]);
  // גרירה מתחילה אחרי 6 פיקסלים, כדי שלחיצה רגילה תפתח שיחה ולא תתחיל גרירה.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const onDragEnd = (e: DragEndEvent) => {
    const over = e.over?.id;
    if (!over || over === e.active.id) return;
    savePrefs.mutate(reorderPrefs(prefs, convs.map((c) => c.peer.id), String(e.active.id), String(over)));
  };
  const peer: StaffPerson | null = useMemo(() => convs.find((c) => c.peer.id === selectedId)?.peer ?? null, [convs, selectedId]);
  const thread = useMemo(() => (peer ? threadWith(messages.data ?? [], me.id, peer.id) : []), [messages.data, me.id, peer]);

  // פתיחת שיחה = נקרא. רק מלחיצה של אדם, ולא מטעינה ברקע.
  useEffect(() => {
    if (!peer) return;
    if (thread.some((m) => m.recipientId === me.id && !m.readAt)) markRead.mutate(peer.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peer?.id, thread.length]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread.length, peer?.id]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body || !peer || send.isPending) return;
    send.mutate({ to: peer, body }, { onSuccess: () => setDraft('') });
  };

  const askNotifications = async () => {
    if (typeof Notification === 'undefined') return;
    const p = await Notification.requestPermission();
    setNotifPerm(p);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">צ'אט צוות</h1>
          <p className="text-sm text-muted-foreground">הודעה ישירה לעובד, בתוך המערכת. על לקוח ספציפי כותבים בצ'אט של ההזמנה או הקריאה.</p>
        </div>
        {notifPerm === 'default' && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={askNotifications}>
            <Bell className="h-4 w-4" />
            הפעל התראות בדפדפן
          </Button>
        )}
        {notifPerm === 'denied' && <span className="text-xs text-muted-foreground">התראות הדפדפן חסומות בהגדרות האתר.</span>}
      </div>

      <div className="flex flex-col gap-3 lg:h-[calc(100vh-13rem)] lg:flex-row">
        {/* האנשים. ב-RTL הילד הראשון בימין. */}
        <div className="flex w-full flex-col gap-2 lg:w-[320px] lg:shrink-0">
          <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="חיפוש עובד" className="h-9" />
          <div className="flex-1 space-y-1 overflow-y-auto pe-1">
            {people.isLoading && <div className="p-3 text-sm text-muted-foreground">טוען…</div>}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={visible.map((c) => c.peer.id)} strategy={verticalListSortingStrategy}>
                {visible.map((c) => (
                  <PersonRow
                    key={c.peer.id}
                    c={c}
                    me={me.id}
                    active={c.peer.id === selectedId}
                    pinned={prefs.pinned.includes(c.peer.id)}
                    draggable={!filter.trim()}
                    onOpen={() => setParams({ to: c.peer.id })}
                    onTogglePin={() => savePrefs.mutate(togglePinned(prefs, c.peer.id))}
                  />
                ))}
              </SortableContext>
            </DndContext>
            {!people.isLoading && visible.length === 0 && <div className="p-3 text-sm text-muted-foreground">לא נמצא עובד.</div>}
            {!people.isLoading && visible.length > 1 && !filter.trim() && (
              <p className="px-1 pt-1 text-[10.5px] text-muted-foreground">גרירה משנה את הסדר, הסיכה נועצת למעלה. נשמר לך בלבד.</p>
            )}
          </div>
        </div>

        {/* השרשור */}
        <div className="flex min-h-[24rem] flex-1 flex-col rounded-xl border bg-white">
          {!peer ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <MessageSquare className="h-6 w-6 text-slate-300" />
              בחר עובד מהרשימה כדי לכתוב לו.
            </div>
          ) : (
            <>
              <div className="border-b px-4 py-2.5">
                <div className="font-semibold text-slate-900">{peer.name}</div>
                <div className="text-xs text-muted-foreground">
                  {ROLE_SHORT[peer.role] ?? peer.role}
                  {peer.role === 'driver' && ' · רואה את ההודעה באפליקציה כשהיא פתוחה'}
                </div>
              </div>
              <div ref={scrollRef} className="flex-1 space-y-1.5 overflow-y-auto bg-slate-50/60 px-4 py-3">
                {messages.isLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> טוען…</div>
                ) : thread.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">עוד לא התכתבתם. אפשר לפתוח.</div>
                ) : (
                  thread.map((m, i) => (
                    <Bubble key={m.id} m={m} mine={m.senderId === me.id} showDay={i === 0 || dayKey(thread[i - 1].createdAt) !== dayKey(m.createdAt)} />
                  ))
                )}
              </div>
              <form onSubmit={submit} className="flex items-center gap-2 border-t p-3">
                {/* אימוג'ים (עידן, 09/10/2026): לוח קבוע של מה ששולחים לעמית בעבודה, מוכנס במיקום הסמן. */}
                <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0" title="אימוג'י" aria-label="אימוג'י">
                      <Smile className="h-5 w-5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent dir="rtl" align="start" className="w-72 p-2">
                    {EMOJI_GROUPS.map((g) => (
                      <div key={g.label} className="mb-1.5">
                        <div className="mb-0.5 px-1 text-[10.5px] font-semibold text-muted-foreground">{g.label}</div>
                        <div className="grid grid-cols-6 gap-0.5">
                          {g.emojis.map((e) => (
                            <button
                              key={e}
                              type="button"
                              className="h-9 rounded-md text-[22px] leading-none hover:bg-slate-100"
                              onClick={() => {
                                const el = inputRef.current;
                                const r = insertAt(draft, e, el?.selectionStart ?? null);
                                setDraft(r.text);
                                requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(r.cursor, r.cursor); });
                              }}
                            >
                              {e}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </PopoverContent>
                </Popover>
                <Input
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={`הודעה ל${peer.name}`}
                  className="h-10 flex-1 text-[16px] sm:text-sm"
                  autoFocus
                />
                <Button type="submit" className="h-10 gap-1.5" disabled={!draft.trim() || send.isPending}>
                  {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 rtl:-scale-x-100" />}
                  שלח
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** שורת עובד: לחיצה פותחת, ידית בצד גוררת, סיכה נועצת. */
function PersonRow({ c, me, active, pinned, draggable, onOpen, onTogglePin }: {
  c: StaffConversation; me: string; active: boolean; pinned: boolean; draggable: boolean; onOpen: () => void; onTogglePin: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: c.peer.id, disabled: !draggable });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className={`flex items-stretch rounded-xl border transition ${
        active ? 'border-primary/40 bg-primary/5' : c.unread > 0 ? 'border-blue-200 bg-blue-50/50 hover:bg-blue-50' : pinned ? 'border-amber-200 bg-amber-50/30 hover:bg-amber-50/60' : 'border-slate-200 bg-white hover:bg-slate-50'
      }`}
    >
      {draggable && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="flex w-6 shrink-0 cursor-grab items-center justify-center text-slate-300 hover:text-slate-500 active:cursor-grabbing"
          title="גרור לשינוי הסדר"
          aria-label="גרור לשינוי הסדר"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}
      <button onClick={onOpen} className="min-w-0 flex-1 py-2 pe-1 ps-2 text-start">
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5">
            {pinned && <Pin className="h-3 w-3 shrink-0 text-amber-600" />}
            <span className="truncate text-sm font-semibold text-slate-900">{c.peer.name}</span>
            <span className="shrink-0 rounded bg-slate-100 px-1 text-[10px] text-slate-600">{ROLE_SHORT[c.peer.role] ?? c.peer.role}</span>
          </span>
          {c.unread > 0 ? (
            <span className="shrink-0 rounded-full bg-blue-600 px-1.5 text-[11px] font-bold text-white">{c.unread}</span>
          ) : c.lastMessage ? (
            <span className="shrink-0 text-[11px] text-muted-foreground">{ddmm(c.lastMessage.createdAt)}</span>
          ) : null}
        </div>
        {c.lastMessage && (
          <div className="truncate text-xs text-muted-foreground">
            {c.lastMessage.senderId === me ? 'אני: ' : ''}{c.lastMessage.body}
          </div>
        )}
      </button>
      <button
        type="button"
        onClick={onTogglePin}
        className={`flex w-8 shrink-0 items-center justify-center rounded-e-xl ${pinned ? 'text-amber-600 hover:bg-amber-100' : 'text-slate-300 hover:bg-slate-100 hover:text-slate-600'}`}
        title={pinned ? 'הסר נעיצה' : 'נעץ לראש הרשימה'}
        aria-label={pinned ? `הסר נעיצה ${c.peer.name}` : `נעץ ${c.peer.name}`}
      >
        {pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

function Bubble({ m, mine, showDay }: { m: StaffMessage; mine: boolean; showDay: boolean }) {
  return (
    <>
      {showDay && <div className="py-1 text-center text-[11px] text-muted-foreground">{ddmm(m.createdAt)}</div>}
      <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
        <div className={`max-w-[80%] rounded-2xl px-3 py-1.5 text-[13.5px] leading-relaxed ${mine ? 'rounded-ee-sm bg-primary text-white' : 'rounded-es-sm border bg-white text-slate-900'}`}>
          {/* הודעה שכולה אימוג'י מוצגת גדול, כמו בוואטסאפ. */}
          <div className={isEmojiOnly(m.body) ? 'py-1 text-[34px] leading-none' : 'whitespace-pre-line'}>{m.body}</div>
          <div className={`mt-0.5 text-[10px] ${mine ? 'text-white/70' : 'text-muted-foreground'}`}>
            <bdi>{hhmm(m.createdAt)}</bdi>
            {mine && m.readAt && ' · נקרא'}
          </div>
        </div>
      </div>
    </>
  );
}
