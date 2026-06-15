import { useState, useRef, useEffect, type KeyboardEvent, useMemo } from 'react';
import { Send, Smile, AtSign, Paperclip, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAllProfiles } from '@/hooks/useProfile';
import { useAuth } from '@/lib/auth-context';
import { ROLE_LABELS } from '@/types/profile';
import { splitByMentions } from '@/lib/mentions';

// Adapted from parcel-story: getUsers()/AppUser → useAllProfiles()/Profile.

interface CommentInputProps {
  onSubmit: (content: string, mentions: string[]) => void;
  placeholder?: string;
  autoFocus?: boolean;
  onUploadClick?: () => void;
  onCameraCapture?: (files: File[]) => void;
}

const EMOJIS = ['👍', '👎', '❤️', '🎉', '🚚', '✅', '⚠️', '📦', '💰', '📝'];

interface MentionUser {
  id: string;
  displayName: string;
  roleLabel?: string;
}

export function CommentInput({
  onSubmit,
  placeholder = 'כתוב הודעה...',
  autoFocus = false,
  onUploadClick,
  onCameraCapture,
}: CommentInputProps) {
  const { user: currentUser } = useAuth();
  const { data: profiles = [] } = useAllProfiles();
  const [content, setContent] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentions, setMentions] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Mentionable users: active profiles excluding the current user.
  const users: MentionUser[] = useMemo(
    () =>
      profiles
        .filter((p) => !p.disabled && p.id !== currentUser?.id)
        .map((p) => ({
          id: p.id,
          displayName: p.fullName || p.username || p.email,
          roleLabel: ROLE_LABELS[p.role],
        })),
    [profiles, currentUser?.id]
  );

  // The colored overlay must scroll together with the input — otherwise on a
  // long message the typed text "disappears" outside the frame.
  const syncOverlayScroll = () => {
    if (overlayRef.current && inputRef.current) {
      overlayRef.current.scrollLeft = inputRef.current.scrollLeft;
    }
  };

  useEffect(() => {
    const raf = requestAnimationFrame(syncOverlayScroll);
    return () => cancelAnimationFrame(raf);
  }, [content]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
      return;
    }
    if (e.key === '@') {
      setShowMentions(true);
      setMentionSearch('');
    }
    if (e.key === 'Escape') {
      setShowMentions(false);
    }
  };

  const handleTextChange = (value: string) => {
    setContent(value);
    const words = value.split(/\s+/);
    const lastWord = words[words.length - 1];
    if (lastWord.startsWith('@')) {
      setShowMentions(true);
      setMentionSearch(lastWord.substring(1));
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (displayName: string) => {
    const words = content.split(/\s+/);
    words[words.length - 1] = `@${displayName}`;
    setContent(words.join(' ') + ' ');
    setShowMentions(false);
    if (!mentions.includes(displayName)) setMentions([...mentions, displayName]);
    inputRef.current?.focus();
  };

  const insertEmoji = (emoji: string) => {
    setContent(content + emoji);
    inputRef.current?.focus();
  };

  const handleSubmit = () => {
    if (!content.trim()) return;
    onSubmit(content.trim(), mentions);
    setContent('');
    setMentions([]);
    setShowMentions(false);
  };

  const filteredUsers = users.filter((u) => u.displayName.includes(mentionSearch));
  const canSubmit = content.trim().length > 0;

  return (
    <div className="relative flex items-end gap-1.5">
      {/* Mentions dropdown */}
      {showMentions && filteredUsers.length > 0 && (
        <div className="absolute bottom-full right-0 left-0 mb-1 bg-popover border rounded-lg shadow-lg max-h-48 overflow-y-auto z-10">
          <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide border-b bg-muted/40 flex items-center gap-1.5">
            <AtSign className="h-3 w-3" />
            תייג עובד
          </div>
          {filteredUsers.map((u) => {
            const initials = u.displayName
              .split(' ')
              .slice(0, 2)
              .map((w) => w[0])
              .join('');
            return (
              <button
                key={u.id}
                onClick={() => insertMention(u.displayName)}
                className="w-full text-right px-3 py-2 hover:bg-accent/10 transition-colors flex items-center gap-2.5 text-sm"
              >
                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                  {initials}
                </div>
                <div className="flex-1 min-w-0 text-right">
                  <div className="font-medium truncate">{u.displayName}</div>
                  {u.roleLabel && (
                    <div className="text-[10px] text-muted-foreground truncate">{u.roleLabel}</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Attach + Camera + Emoji buttons */}
      <div className="flex items-center gap-0.5 pb-0.5">
        {onUploadClick && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={onUploadClick}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
        )}
        {onCameraCapture && (
          <>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const files = e.target.files;
                if (files && files.length > 0) {
                  onCameraCapture(Array.from(files));
                }
                e.target.value = '';
              }}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => cameraInputRef.current?.click()}
            >
              <Camera className="h-4 w-4" />
            </Button>
          </>
        )}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <Smile className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="start" side="top">
            <div className="grid grid-cols-5 gap-1">
              {EMOJIS.map((emoji, index) => (
                <button
                  key={index}
                  onClick={() => insertEmoji(emoji)}
                  className="h-8 w-8 hover:bg-accent rounded flex items-center justify-center text-lg"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Input field — transparent input layered over a styled overlay so @mentions highlight live while typing */}
      <div className="flex-1 relative h-9">
        <div
          ref={overlayRef}
          aria-hidden
          className="absolute inset-0 px-3 flex items-center text-base rounded-full border border-border/60 bg-background overflow-hidden whitespace-pre pointer-events-none"
          dir="rtl"
        >
          {content ? (
            splitByMentions(
              content,
              users.map((u) => u.displayName)
            ).map((seg, i) =>
              seg.type === 'mention' ? (
                <span key={i} className="text-primary font-semibold">
                  {seg.value}
                </span>
              ) : (
                <span key={i}>{seg.value}</span>
              )
            )
          ) : (
            <span className="text-muted-foreground/60">{placeholder}</span>
          )}
        </div>
        <input
          ref={inputRef}
          type="text"
          value={content}
          onChange={(e) => handleTextChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onScroll={syncOverlayScroll}
          onKeyUp={syncOverlayScroll}
          onClick={syncOverlayScroll}
          autoFocus={autoFocus}
          className="absolute inset-0 w-full h-full px-3 text-base bg-transparent text-transparent caret-primary border border-transparent rounded-full focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-transparent selection:bg-primary/30 selection:text-foreground"
          dir="rtl"
        />
      </div>

      {/* Send button */}
      <Button
        onClick={handleSubmit}
        disabled={!canSubmit}
        size="icon"
        className={`h-9 w-9 rounded-full flex-shrink-0 transition-all ${
          canSubmit
            ? 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm'
            : 'bg-muted text-muted-foreground'
        }`}
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}
