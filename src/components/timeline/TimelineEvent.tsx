import { FileText, Package, Upload, Plus, Check, CalendarClock } from 'lucide-react';
import type { TimelineEvent as TimelineEventModel } from '@/types/timeline';
import { useAuth } from '@/lib/auth-context';
import { splitByMentions } from '@/lib/mentions';

// Adapted from parcel-story `src/components/timeline/TimelineEvent.tsx`.
// rashal event types: comment | file_upload | status_change | created.

interface TimelineEventProps {
  event: TimelineEventModel;
}

function renderContentWithMentions(content: string, knownMentions: string[] = []) {
  return splitByMentions(content, knownMentions).map((seg, idx) => {
    if (seg.type === 'mention') {
      return (
        <span
          key={idx}
          className="inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded-md bg-primary/15 text-primary font-bold text-[0.9em] ring-1 ring-primary/40"
        >
          {seg.value}
        </span>
      );
    }
    return <span key={idx}>{seg.value}</span>;
  });
}

const SYSTEM_EVENT_TYPES = ['created', 'status_change', 'reschedule'];

export function TimelineEvent({ event }: TimelineEventProps) {
  const { user } = useAuth();
  const isComment = event.type === 'comment';
  const isFileUpload = event.type === 'file_upload';
  const isSystem = SYSTEM_EVENT_TYPES.includes(event.type);

  // "My" messages go to the left (like WhatsApp).
  const isMe = event.userId === user?.id || event.userId === 'current-user';

  const getSystemIcon = () => {
    switch (event.type) {
      case 'created':
        return <Plus className="h-3 w-3" />;
      case 'status_change':
        return <Package className="h-3 w-3" />;
      case 'reschedule':
        return <CalendarClock className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const getSystemColor = () => {
    switch (event.type) {
      case 'created':
        return 'bg-blue-500/10 text-blue-700 dark:text-blue-300';
      case 'status_change':
        return 'bg-purple-500/10 text-purple-700 dark:text-purple-300';
      case 'reschedule':
        return 'bg-amber-500/15 text-amber-700 dark:text-amber-300';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getSystemLabel = () => {
    switch (event.type) {
      case 'created':
        return 'נוצר';
      case 'status_change':
        return 'שינוי סטטוס';
      case 'reschedule':
        return 'שיבוץ מחדש';
      default:
        return 'אירוע';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
      if (diffInMinutes < 1) return 'עכשיו';
      return `לפני ${diffInMinutes} דק׳`;
    }
    if (diffInHours < 24) return `לפני ${diffInHours} שע׳`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return 'אתמול';
    if (diffInDays < 7) return `לפני ${diffInDays} ימים`;

    return date.toLocaleDateString('he-IL', {
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  const getUserInitials = (name: string) => {
    const words = name.split(' ');
    if (words.length >= 2) return words[0][0] + words[1][0];
    return name.substring(0, 2);
  };

  // ─── System event (centered pill) ───
  if (isSystem) {
    return (
      <div className="flex justify-center my-3">
        <div
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${getSystemColor()} shadow-sm`}
        >
          {getSystemIcon()}
          <span>{getSystemLabel()}</span>
          {event.content && <span className="opacity-80">• {event.content}</span>}
          {event.metadata?.oldStatus && event.metadata?.newStatus && (
            <span className="opacity-80">
              • {event.metadata.oldStatus} ← {event.metadata.newStatus}
            </span>
          )}
          <span className="opacity-60 mr-1">{formatTimestamp(event.createdAt)}</span>
        </div>
      </div>
    );
  }

  // ─── Chat bubble (comment / file upload) ───
  return (
    <div className={`flex gap-2 mb-3 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div
        className={`h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-1 ${
          isMe
            ? 'bg-gradient-to-br from-teal-500 to-teal-600'
            : 'bg-gradient-to-br from-blue-500 to-purple-500'
        }`}
      >
        {getUserInitials(event.userName)}
      </div>

      {/* Bubble */}
      <div className={`max-w-[80%] ${isMe ? 'items-end' : 'items-start'}`}>
        {!isMe && (
          <p className="text-[11px] font-semibold text-muted-foreground mb-0.5 text-right px-2">
            {event.userName}
          </p>
        )}

        <div
          className={`relative px-3 py-2 shadow-sm ${
            isMe
              ? 'bg-primary/10 dark:bg-primary/15 rounded-2xl rounded-bl-md'
              : 'bg-card border border-border/60 rounded-2xl rounded-br-md'
          }`}
        >
          {event.content && (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {isComment
                ? renderContentWithMentions(event.content, event.metadata?.mentions || [])
                : event.content}
            </p>
          )}

          {/* Image previews */}
          {event.metadata?.imageUrls && event.metadata.imageUrls.length > 0 && (
            <div
              className={`${event.content ? 'mt-2' : ''} grid gap-1.5 ${
                event.metadata.imageUrls.length > 1 ? 'grid-cols-2' : 'grid-cols-1'
              }`}
            >
              {event.metadata.imageUrls.map((url: string, index: number) => (
                <img
                  key={index}
                  src={url}
                  alt={event.files?.[index] || 'תמונה'}
                  className="rounded-lg w-full max-h-48 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => window.open(url, '_blank')}
                />
              ))}
            </div>
          )}

          {/* Non-image files */}
          {event.files &&
            event.files.length > 0 &&
            (!event.metadata?.imageUrls || event.metadata.imageUrls.length === 0) && (
              <div className={`space-y-1.5 ${event.content ? 'mt-2' : ''}`}>
                {event.files.map((fileName, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-2 bg-background/60 border border-border/40 rounded-lg text-sm"
                  >
                    {isFileUpload ? (
                      <Upload className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                    ) : (
                      <FileText className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                    )}
                    <span className="text-xs font-medium truncate">{fileName}</span>
                  </div>
                ))}
              </div>
            )}

          {/* Timestamp */}
          <div className={`flex items-center gap-1 mt-1 ${isMe ? 'justify-start' : 'justify-end'}`}>
            <span className="text-[10px] text-muted-foreground/70">
              {formatTimestamp(event.createdAt)}
            </span>
            {isMe && <Check className="h-3 w-3 text-primary/60" />}
          </div>
        </div>
      </div>
    </div>
  );
}
