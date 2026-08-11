import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Eraser, PenLine } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SignaturePadProps {
  label: string;
  /** נקרא בכל שינוי: data URL של PNG, או null כשהלוח ריק. */
  onChange: (dataUrl: string | null) => void;
  required?: boolean;
  disabled?: boolean;
  height?: number;
}

/**
 * לוח חתימה באצבע.
 *
 * שלוש נקודות שקבעו את המימוש, כולן מהתנהגות של דפדפן בטלפון:
 * 1. `touch-action: none` על הקנבס — בלעדיו הגלילה של הדף גונבת את המחווה
 *    והחתימה יוצאת קטועה.
 * 2. הקנבס מוגדל לפי devicePixelRatio, אחרת הקו יוצא מרוסק במסך רטינה.
 * 3. שינוי גודל (סיבוב המכשיר) מנקה את הקנבס, ולכן הקווים נשמרים כנקודות
 *    ומצוירים מחדש במקום להסתמך על מה שכבר צויר.
 */
export function SignaturePad({
  label,
  onChange,
  required,
  disabled,
  height = 180,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<Array<Array<{ x: number; y: number }>>>([]);
  const drawingRef = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== Math.round(rect.width * dpr)) {
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const stroke of strokesRef.current) {
      if (stroke.length === 0) continue;
      ctx.beginPath();
      if (stroke.length === 1) {
        // נגיעה בודדת — נקודה, אחרת החתימה "בולעת" טפיחות קצרות
        ctx.arc(stroke[0].x, stroke[0].y, 1.1, 0, Math.PI * 2);
        ctx.fillStyle = '#0f172a';
        ctx.fill();
        continue;
      }
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i++) ctx.lineTo(stroke[i].x, stroke[i].y);
      ctx.stroke();
    }
  }, []);

  useEffect(() => {
    redraw();
    const onResize = () => redraw();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, [redraw]);

  const emit = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ink = strokesRef.current.some((s) => s.length > 0);
    setHasInk(ink);
    onChange(ink ? canvas.toDataURL('image/png') : null);
  }, [onChange]);

  const pointFrom = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    strokesRef.current.push([pointFrom(e)]);
    redraw();
  };

  const handleMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || disabled) return;
    const stroke = strokesRef.current[strokesRef.current.length - 1];
    if (!stroke) return;
    stroke.push(pointFrom(e));
    redraw();
  };

  const handleUp = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    emit();
  };

  const clear = () => {
    strokesRef.current = [];
    redraw();
    emit();
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-slate-800">
          {label}
          {required && <span className="text-red-600"> *</span>}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={clear}
          disabled={disabled || !hasInk}
          className="h-8 gap-1 text-slate-500"
        >
          <Eraser className="h-3.5 w-3.5" />
          נקה
        </Button>
      </div>

      <div
        className={cn(
          'relative rounded-xl border-2 bg-white transition-colors',
          hasInk ? 'border-emerald-400' : 'border-dashed border-slate-300',
          disabled && 'opacity-50',
        )}
        style={{ height }}
      >
        {!hasInk && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 text-slate-400">
            <PenLine className="h-5 w-5" />
            <span className="text-xs">חתום כאן באצבע</span>
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="h-full w-full rounded-xl"
          style={{ touchAction: 'none' }}
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
          onPointerCancel={handleUp}
          onPointerLeave={handleUp}
        />
        {/* קו החתימה, מתחת לכתב */}
        <div className="pointer-events-none absolute inset-x-6 bottom-7 border-b border-slate-200" />
      </div>
    </div>
  );
}
