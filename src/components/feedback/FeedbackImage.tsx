import { useEffect, useState } from 'react';
import { signedUrl } from '@/lib/feedback';
import { ImageIcon, Loader2 } from 'lucide-react';

/** Resolves a private storage path to a signed URL and renders a thumbnail.
 *  Click opens the full image in a new tab. */
export function FeedbackImage({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    signedUrl(path)
      .then((u) => alive && (u ? setUrl(u) : setFailed(true)))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [path]);

  if (failed) {
    return (
      <div className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
        <ImageIcon className="h-3.5 w-3.5" /> תמונה לא זמינה
      </div>
    );
  }
  if (!url) {
    return (
      <div className="flex h-24 w-32 items-center justify-center rounded-md bg-muted">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block">
      <img
        src={url}
        alt="צילום מסך"
        className="max-h-48 w-auto rounded-md border object-cover transition-opacity hover:opacity-90"
      />
    </a>
  );
}
