import { useQuery } from '@tanstack/react-query';
import { BellRing, MessageSquareReply } from 'lucide-react';
import { supabase } from '@/lib/supabase';

/**
 * דוח התזכורות במסך דוח הבוקר (עידן, 04/11/2026): אמש ב-19:00 יצאה תזכורת
 * ללקוחות של היום, וכאן מי ענה ומה כתב. אותם נתונים בדיוק כמו ההודעה למנהלים
 * (`reminder_replies(date)`), ולכן המסך וההודעה לא יכולים לסתור זה את זה.
 */
interface ReplyRow {
  stop_id: string; customer_name: string | null; driver: string | null; source_type: string;
  hours: string | null; reply_text: string | null; reply_at: string | null; reply_count: number;
}
interface Replies { date: string; sent: number; replied: number; no_reply: number; rows: ReplyRow[] }

const KIND: Record<string, string> = {
  delivery: 'אספקה', customer: 'אספקה', pickup: 'איסוף', service: 'שירות', inspection: 'בדיקה', task: 'משימה',
};

export function ReminderRepliesPanel({ date }: { date: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['reminderReplies', date],
    enabled: !!date,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('reminder_replies', { p_date: date });
      if (error) throw error;
      return data as Replies;
    },
  });
  if (!date || isLoading) return null;
  const sent = data?.sent ?? 0;
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm" style={{ borderColor: '#e6ebf3' }}>
      <div className="mb-3 flex items-center gap-2 text-[13px] font-bold" style={{ color: '#0b2a6b' }}>
        <BellRing className="h-4 w-4" />
        תזכורות אמש ללקוחות של היום
        <span className="text-[11px] font-normal text-slate-400">נשלחו ב-19:00, התשובות עד 07:00</span>
      </div>
      {sent === 0 ? (
        <p className="text-[12px] text-slate-500">לא נשלחו תזכורות ליום הזה.</p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-4 text-[12px]">
            <span>נשלחו <b><bdi>{sent}</bdi></b></span>
            <span style={{ color: '#1f7a4d' }}>ענו <b><bdi>{data?.replied ?? 0}</bdi></b></span>
            <span className="text-slate-500">לא ענו <b><bdi>{data?.no_reply ?? 0}</bdi></b></span>
          </div>
          <ul className="space-y-1.5">
            {(data?.rows ?? []).filter((r) => r.reply_text).map((r) => (
              <li key={r.stop_id} className="flex items-start gap-2 rounded-lg bg-emerald-50/60 px-2.5 py-1.5 text-[12px]">
                <MessageSquareReply className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-700" />
                <span>
                  <b>{r.customer_name ?? 'לקוח'}</b>
                  <span className="text-slate-400">
                    {' · '}{KIND[r.source_type] ?? r.source_type}{r.hours ? ` · ${r.hours}` : ''}{r.driver ? ` · ${r.driver}` : ''}
                  </span>
                  <br />
                  <span className="text-slate-800">"{r.reply_text}"</span>
                  {r.reply_count > 1 && <span className="text-slate-400"> (+{r.reply_count - 1})</span>}
                </span>
              </li>
            ))}
          </ul>
          {(data?.no_reply ?? 0) > 0 && (
            <p className="mt-2 text-[11px] text-slate-400">
              לא ענו: {(data?.rows ?? []).filter((r) => !r.reply_text).map((r) => r.customer_name ?? 'לקוח').join(' · ')}
            </p>
          )}
        </>
      )}
    </div>
  );
}
