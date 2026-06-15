import { useState, useRef, useEffect } from 'react';
import { MessageSquare, Filter, Search, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TimelineEvent } from './TimelineEvent';
import { CommentInput } from './CommentInput';
import { FileUploadZone } from './FileUploadZone';
import { cn } from '@/lib/utils';
import type { TimelineEvent as TimelineEventModel } from '@/types/timeline';

// Adapted from parcel-story `InvoiceTimeline`: events are passed in (React Query
// holds them), instead of reading invoice.timeline + page-level handlers.

interface OrderTimelineProps {
  events: TimelineEventModel[];
  onAddComment: (content: string, mentions: string[]) => void;
  onUploadFiles: (files: File[]) => void;
}

type FilterType = 'all' | 'comments' | 'status' | 'files';

export function OrderTimeline({ events, onAddComment, onUploadFiles }: OrderTimelineProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [showUpload, setShowUpload] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = chatContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [events.length]);

  const filteredEvents = events.filter((event) => {
    if (filterType !== 'all') {
      const typeMap: Record<FilterType, string[]> = {
        all: [],
        comments: ['comment'],
        status: ['status_change', 'created'],
        files: ['file_upload'],
      };
      if (!typeMap[filterType].includes(event.type)) return false;
    }
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      return (
        event.userName.toLowerCase().includes(s) || event.content?.toLowerCase().includes(s)
      );
    }
    return true;
  });

  const handleUploadFiles = (files: File[]) => {
    onUploadFiles(files);
    setShowUpload(false);
  };

  const eventCounts = {
    all: events.length,
    comments: events.filter((e) => e.type === 'comment').length,
    status: events.filter((e) => ['status_change', 'created'].includes(e.type)).length,
    files: events.filter((e) => e.type === 'file_upload').length,
  };

  return (
    <div className="flex flex-col">
      {/* Filter toggle */}
      <button
        onClick={() => setShowFilters(!showFilters)}
        className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors mb-2 self-start"
      >
        <Filter className="h-3 w-3" />
        <span>סנן</span>
        <ChevronDown className={cn('h-3 w-3 transition-transform', showFilters && 'rotate-180')} />
      </button>

      {/* Filters */}
      {showFilters && (
        <div className="flex gap-2 mb-3 animate-in slide-in-from-top-2 duration-200">
          <div className="relative flex-1">
            <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="חפש..."
              className="h-8 text-xs pr-8 rounded-lg border-border/40"
            />
          </div>
          <Select value={filterType} onValueChange={(v) => setFilterType(v as FilterType)}>
            <SelectTrigger className="w-[130px] h-8 text-xs rounded-lg border-border/40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">הכל ({eventCounts.all})</SelectItem>
              <SelectItem value="comments">הודעות ({eventCounts.comments})</SelectItem>
              <SelectItem value="status">סטטוס ({eventCounts.status})</SelectItem>
              <SelectItem value="files">קבצים ({eventCounts.files})</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Chat card */}
      <div className="rounded-xl border border-border/40 bg-card overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-3 py-2 bg-muted/20 border-b border-border/30 flex items-center gap-2">
          <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center">
            <MessageSquare className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="text-xs font-semibold">שיחה</span>
          <span className="text-[10px] text-muted-foreground/50 tabular-nums">({eventCounts.all})</span>
        </div>

        {/* Messages */}
        <div ref={chatContainerRef} className="px-3 pt-3 pb-1 max-h-[350px] overflow-y-auto bg-muted/[0.03]">
          {filteredEvents.length > 0 ? (
            <>
              <div className="flex justify-center mb-3">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] bg-muted/40 text-muted-foreground/50">
                  <div className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                  תחילת השיחה
                </div>
              </div>

              {filteredEvents.map((event) => (
                <TimelineEvent key={event.id} event={event} />
              ))}
            </>
          ) : (
            <div className="py-8 text-center text-muted-foreground/30">
              <MessageSquare className="h-7 w-7 mx-auto mb-2 opacity-30" />
              <p className="text-[11px]">
                {searchTerm || filterType !== 'all' ? 'לא נמצאו אירועים' : 'אין הודעות עדיין'}
              </p>
            </div>
          )}
        </div>

        {/* Upload zone */}
        {showUpload && (
          <div className="px-3 py-2 border-t border-border/30 bg-muted/10 animate-in slide-in-from-bottom-2 duration-200">
            <FileUploadZone onFilesSelected={handleUploadFiles} maxFiles={5} maxSizeMB={10} compact={false} />
          </div>
        )}

        {/* Input bar */}
        <div className="border-t border-border/30 p-2 bg-card">
          <CommentInput
            onSubmit={onAddComment}
            placeholder="כתוב הודעה..."
            onUploadClick={() => setShowUpload(!showUpload)}
            onCameraCapture={handleUploadFiles}
          />
        </div>
      </div>
    </div>
  );
}
