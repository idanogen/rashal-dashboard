import { MessageCircle, RefreshCw } from 'lucide-react';
import { useQueryClient, useIsFetching } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { InboxBoard } from '@/components/wa/InboxBoard';
import { WA_INBOX_KEY } from '@/lib/wa-inbox-query';

/** הדף המלא. הלוח עצמו משותף עם החלונית הצפה. */
export function InboxPage() {
  const qc = useQueryClient();
  const fetching = useIsFetching({ queryKey: [WA_INBOX_KEY] }) > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
            <MessageCircle className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">תיבת השיחות</h1>
            <p className="text-sm text-muted-foreground">
              כל השיחות בוואטסאפ מול הלקוחות, ומי מחכה לתשובה
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => qc.invalidateQueries({ queryKey: [WA_INBOX_KEY] })}
          disabled={fetching}
        >
          <RefreshCw className={`h-4 w-4 ${fetching ? 'animate-spin' : ''}`} />
          רענן
        </Button>
      </div>

      <InboxBoard />
    </div>
  );
}
