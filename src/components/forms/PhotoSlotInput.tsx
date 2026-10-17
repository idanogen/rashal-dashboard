import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import type { PhotoSlot } from '@/lib/forms/types';

/**
 * צילום של נייר חתום (טופס הפורטל של כללית, שטר חוב, ת"ז).
 *
 * ⭐ התמונה מוקטנת בטלפון ל-1600 פיקסלים בצד הארוך ו-JPEG 0.8 לפני שהיא
 * נכנסת ל-PDF. צילום מלא מהמצלמה הוא 4-8 מגה, ושלושה כאלה היו עוברים את
 * תקרת הדחיפה לפריוריטי (`MAX_PAYLOAD` ב-`api/priority-push`) והטופס היה
 * נתקע בתור. 1600 עדיין קריא לחתימה ולמספרים.
 */
const MAX_SIDE = 1600;

async function shrink(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('לא הצלחתי לקרוא את התמונה'));
      i.src = url;
    });
    const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('הדפדפן לא תומך בעיבוד תמונה');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.8);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function PhotoSlotInput({
  slot, value, disabled, onChange,
}: {
  slot: PhotoSlot;
  value: string | null;
  disabled?: boolean;
  onChange: (dataUrl: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      onChange(await shrink(file));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <section className="rounded-xl border bg-card p-4 md:p-5">
      <div className="text-[15px] font-semibold text-foreground">
        {slot.label}
        {slot.required && <span className="text-destructive"> *</span>}
      </div>
      {slot.hint && <p className="mt-1 text-sm text-muted-foreground">{slot.hint}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0])}
      />

      {value ? (
        <div className="mt-3 space-y-3">
          <img src={value} alt={slot.label} className="max-h-80 w-full rounded-lg border bg-muted object-contain" />
          <Button variant="outline" disabled={disabled || busy} onClick={() => inputRef.current?.click()} className="h-11 gap-1.5">
            <RotateCcw className="h-4 w-4" />
            צילום מחדש
          </Button>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
          className="mt-3 flex h-40 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-input bg-muted/40 text-muted-foreground transition-colors hover:bg-muted"
        >
          {busy ? <Loader2 className="h-7 w-7 animate-spin" /> : <Camera className="h-7 w-7" />}
          <span className="text-base font-medium text-foreground">צילום</span>
        </button>
      )}
    </section>
  );
}
