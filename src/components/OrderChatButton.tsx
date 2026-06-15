import { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { OrderChatSheet, type ChatOrderRef } from './OrderChatSheet';
import { useCommentCounts } from '@/hooks/useTimeline';

interface OrderChatButtonProps {
  order: ChatOrderRef;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Per-row chat trigger + comment-count badge.
 * Adapted from parcel-story InvoiceChatButton — no notification/unread pulse
 * (rashal has no notification system yet).
 */
export function OrderChatButton({ order, size = 'sm', className = '' }: OrderChatButtonProps) {
  const [open, setOpen] = useState(false);
  const { data: commentCounts = {} } = useCommentCounts();

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setOpen(true);
  };

  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const btnSize = size === 'sm' ? 'h-7 w-7' : 'h-8 w-8';
  const commentCount = commentCounts[order.id] || 0;

  return (
    <>
      <button
        onClick={handleOpen}
        onPointerDown={(e) => e.stopPropagation()}
        className={`${btnSize} inline-flex items-center justify-center rounded-lg transition-colors relative text-muted-foreground hover:text-primary hover:bg-primary/10 ${className}`}
        title="פתח שיחה"
      >
        <MessageSquare className={iconSize} />
        {commentCount > 0 && (
          <span className="absolute -top-1 -end-1 h-4 min-w-4 px-0.5 rounded-full text-[9px] font-bold flex items-center justify-center shadow-sm bg-primary text-primary-foreground">
            {commentCount}
          </span>
        )}
      </button>

      <OrderChatSheet order={order} open={open} onOpenChange={setOpen} />
    </>
  );
}
