import { MessageCircle } from 'lucide-react';
import { ddmm, hhmm } from '@/lib/stop-info-text';

/** אבני הבניין של חלונית העצירה. הופרדו מ-`StopCallInfoSheet` ב-26/10/2026 (תקרת 400 שורות). */
export function Section({ icon, title, meta, children }: { icon: React.ReactNode; title: string; meta?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-bold text-slate-900">
        {icon}
        {title}
        {meta && (
          <span className="ms-auto rounded-full bg-slate-100 px-2 text-[10.5px] font-medium text-slate-500">{meta}</span>
        )}
      </div>
      {children}
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/60 p-2.5 text-xs text-muted-foreground">{children}</div>;
}

export function OfficeNoteSection({ note }: { note: { userName: string; content: string; at: string } | null }) {
  if (!note) return null;
  return (
    <Section icon={<MessageCircle className="h-4 w-4 text-primary" />} title="מהמשרד" meta="צ'אט">
      <div className="rounded-lg border bg-slate-50 p-2.5 text-[13px]">
        <div className="mb-0.5 text-[11px] font-bold text-slate-700">
          {note.userName} · <bdi>{ddmm(note.at)} {hhmm(note.at)}</bdi>
        </div>
        <div className="whitespace-pre-line">{note.content}</div>
      </div>
    </Section>
  );
}
