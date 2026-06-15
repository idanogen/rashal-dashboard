import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { useCurrentProfile, useIsAdmin } from '@/hooks/useProfile';
import {
  useFeedbackThreads,
  useThreadMessages,
  useCreateThread,
  useAddMessage,
  useSetThreadStatus,
  useDeleteThread,
} from '@/hooks/useFeedback';
import { uploadAttachment } from '@/lib/feedback';
import { FeedbackImage } from '@/components/feedback/FeedbackImage';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { FeedbackThread } from '@/types/feedback';
import {
  MessageSquarePlus,
  ArrowRight,
  ImagePlus,
  Send,
  X,
  Loader2,
  Check,
  CheckCheck,
  Trash2,
  ChevronLeft,
  LogOut,
  MessageSquare,
} from 'lucide-react';

function timeLabel(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const TEXTAREA_CLS =
  'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none';

/* ─────────────────────────── Composer ─────────────────────────── */

function MessageComposer({
  onSend,
  placeholder,
  cta = 'שלח',
  autoFocus,
}: {
  onSend: (body: string, imagePath?: string) => Promise<void> | void;
  placeholder: string;
  cta?: string;
  autoFocus?: boolean;
}) {
  const [body, setBody] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const canSend = (!!body.trim() || !!file) && !busy;

  async function submit() {
    if (!canSend) return;
    setBusy(true);
    try {
      let imagePath: string | undefined;
      if (file) imagePath = await uploadAttachment(file);
      await onSend(body.trim(), imagePath);
      setBody('');
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (e) {
      toast.error(`שגיאה בשליחה: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder}
        rows={3}
        autoFocus={autoFocus}
        dir="auto"
        className={TEXTAREA_CLS}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
        }}
      />
      {file && (
        <div className="flex items-center gap-2 rounded-md bg-muted/60 px-2 py-1.5 text-xs">
          <ImagePlus className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1 truncate">{file.name}</span>
          <button onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value=''; }} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <div className="flex items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="gap-1.5">
          <ImagePlus className="h-4 w-4" />
          צילום מסך
        </Button>
        <Button type="button" size="sm" onClick={submit} disabled={!canSend} className="ms-auto gap-1.5">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {cta}
        </Button>
      </div>
    </div>
  );
}

/* ─────────────────────────── New-thread dialog ─────────────────────────── */

function NewThreadDialog({ onCreated }: { onCreated: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const createThread = useCreateThread();

  return (
    <>
      <Button onClick={() => setOpen(true)} className="gap-1.5">
        <MessageSquarePlus className="h-4 w-4" />
        הערה חדשה
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle>הערה חדשה</DialogTitle>
            <DialogDescription>כתוב את ההערה. אפשר לצרף צילום מסך. נמשיך משם בשיחה.</DialogDescription>
          </DialogHeader>
          <MessageComposer
            autoFocus
            placeholder="מה רצית לומר?"
            cta="פתח הערה"
            onSend={async (body, imagePath) => {
              const id = await createThread.mutateAsync({ body, imagePath });
              setOpen(false);
              onCreated(id);
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ─────────────────────────── Thread list ─────────────────────────── */

function ThreadList({
  threads,
  selectedId,
  onSelect,
}: {
  threads: FeedbackThread[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  if (threads.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        <MessageSquare className="mx-auto mb-2 h-10 w-10 opacity-30" />
        אין הערות עדיין. פתח את הראשונה ✍️
      </div>
    );
  }
  return (
    <div className="divide-y">
      {threads.map((t) => (
        <button
          key={t.id}
          onClick={() => onSelect(t.id)}
          className={cn(
            'flex w-full flex-col items-stretch gap-1 px-3 py-3 text-right transition-colors hover:bg-muted/50',
            selectedId === t.id && 'bg-primary/5'
          )}
        >
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm truncate flex-1">{t.authorName}</span>
            {t.status === 'resolved' ? (
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">טופל</Badge>
            ) : (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">פתוח</Badge>
            )}
          </div>
          {t.subject && <div className="text-xs font-medium text-foreground/80 truncate">{t.subject}</div>}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="truncate flex-1" dir="auto">{t.lastMessagePreview ?? '—'}</span>
            <span className="flex-shrink-0">{timeLabel(t.lastMessageAt ?? t.updatedAt)}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

/* ─────────────────────────── Conversation ─────────────────────────── */

function Conversation({
  thread,
  onBack,
}: {
  thread: FeedbackThread;
  onBack: () => void;
}) {
  const { user } = useAuth();
  const isAdmin = useIsAdmin();
  const { data: messages, isLoading } = useThreadMessages(thread.id);
  const addMessage = useAddMessage();
  const setStatus = useSetThreadStatus();
  const deleteThread = useDeleteThread();
  const bottomRef = useRef<HTMLDivElement>(null);

  const canReply = isAdmin || thread.createdBy === user?.id;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages?.length]);

  return (
    <div className="flex h-full flex-col">
      {/* Conversation header */}
      <div className="flex items-center gap-2 border-b px-3 py-2.5">
        <Button variant="ghost" size="sm" onClick={onBack} className="md:hidden">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm truncate">{thread.authorName}</span>
            {thread.status === 'resolved' && (
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">טופל</Badge>
            )}
          </div>
          {thread.subject && <div className="text-xs text-muted-foreground truncate">{thread.subject}</div>}
        </div>
        {isAdmin && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStatus.mutate({ id: thread.id, status: thread.status === 'resolved' ? 'open' : 'resolved' })}
              className="gap-1 text-xs"
            >
              {thread.status === 'resolved' ? <Check className="h-3.5 w-3.5" /> : <CheckCheck className="h-3.5 w-3.5" />}
              {thread.status === 'resolved' ? 'פתח מחדש' : 'סמן כטופל'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (confirm('למחוק את ההערה והשיחה? פעולה בלתי הפיכה.')) {
                  deleteThread.mutate(thread.id);
                  onBack();
                }
              }}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          (messages ?? []).map((m) => {
            const mine = m.authorId === user?.id;
            return (
              <div key={m.id} className={cn('flex flex-col gap-1', m.authorIsAdmin ? 'items-start' : 'items-end')}>
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm',
                    m.authorIsAdmin
                      ? 'rounded-bl-sm bg-primary text-primary-foreground'
                      : 'rounded-br-sm bg-muted'
                  )}
                >
                  <div className={cn('mb-0.5 text-[10px] font-medium', m.authorIsAdmin ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                    {m.authorName}{m.authorIsAdmin ? ' · מנהל' : ''}{mine ? ' (אני)' : ''}
                  </div>
                  {m.body && <div className="whitespace-pre-wrap break-words" dir="auto">{m.body}</div>}
                  {m.imagePath && <div className="mt-1.5"><FeedbackImage path={m.imagePath} /></div>}
                </div>
                <span className="px-1 text-[10px] text-muted-foreground">{timeLabel(m.createdAt)}</span>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Reply box */}
      <div className="border-t p-3">
        {canReply ? (
          <MessageComposer
            placeholder={isAdmin ? 'הגב להערה…' : 'הוסף תגובה…'}
            cta="שלח"
            onSend={(body, imagePath) => addMessage.mutateAsync({ threadId: thread.id, body, imagePath })}
          />
        ) : (
          <p className="text-center text-xs text-muted-foreground">רק פותח ההערה והמנהל יכולים להגיב כאן.</p>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────── Page ─────────────────────────── */

export function FeedbackPage() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { data: profile } = useCurrentProfile();
  const isAdmin = useIsAdmin();
  const { data: threads, isLoading } = useFeedbackThreads();
  const [selectedId, setSelectedId] = useState<string>();

  const selected = threads?.find((t) => t.id === selectedId);
  const homePath = profile?.role === 'driver' ? '/driver' : '/';

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b bg-card/90 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(homePath)} className="gap-1">
            <ArrowRight className="h-4 w-4" />
            חזרה
          </Button>
          <h1 className="text-base font-bold">📝 הערות{isAdmin ? ' (כולן)' : ''}</h1>
        </div>
        <div className="flex items-center gap-2">
          <NewThreadDialog onCreated={(id) => setSelectedId(id)} />
          <Button variant="ghost" size="sm" onClick={() => signOut()} title="התנתק">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Body */}
      <div className="mx-auto flex w-full max-w-5xl flex-1 overflow-hidden">
        {/* Thread list */}
        <aside
          className={cn(
            'w-full overflow-y-auto border-l md:block md:w-80',
            selectedId && 'hidden md:block'
          )}
        >
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <ThreadList threads={threads ?? []} selectedId={selectedId} onSelect={setSelectedId} />
          )}
        </aside>

        {/* Conversation */}
        <main className={cn('flex-1', !selectedId && 'hidden md:block')}>
          {selected ? (
            <Conversation thread={selected} onBack={() => setSelectedId(undefined)} />
          ) : (
            <div className="hidden h-full flex-col items-center justify-center text-center text-sm text-muted-foreground md:flex">
              <MessageSquare className="mb-2 h-12 w-12 opacity-20" />
              בחר הערה כדי לראות את השיחה
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
