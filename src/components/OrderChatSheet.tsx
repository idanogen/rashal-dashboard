import { MessageSquare } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { OrderTimeline } from '@/components/timeline/OrderTimeline';
import { useTimeline, useAddComment, useUploadFiles } from '@/hooks/useTimeline';
import type { ChatSourceKind } from '@/lib/timeline';

/** Minimal reference the chat needs (full Order satisfies this; kind defaults to 'order'). */
export interface ChatOrderRef {
  id: string;
  customerName: string;
  city?: string;
  kind?: ChatSourceKind;
}

interface OrderChatSheetProps {
  order: ChatOrderRef;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Side sheet with the chat/timeline for one order.
 * Used by OrderChatButton (per row) and by GlobalChatProvider.
 * Adapted from parcel-story InvoiceChatSheet — React Query holds the events,
 * so no local enrichedInvoice state / manual refetch loop.
 */
export function OrderChatSheet({ order, open, onOpenChange }: OrderChatSheetProps) {
  const source = { kind: order.kind ?? 'order', id: order.id } as const;
  const { data: events = [] } = useTimeline(source, open);
  const addComment = useAddComment(source);
  const uploadFiles = useUploadFiles(source);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-full sm:max-w-lg p-0 flex flex-col" dir="rtl">
        <SheetHeader className="p-4 border-b border-border/40 bg-muted/20">
          <SheetTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4 text-primary" />
            שיחה — {order.customerName}
            {order.city && (
              <span className="text-sm font-normal text-muted-foreground">({order.city})</span>
            )}
          </SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-auto p-4">
          <OrderTimeline
            events={events}
            onAddComment={(content, mentions) => addComment.mutate({ content, mentions })}
            onUploadFiles={(files) => uploadFiles.mutate({ files })}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
