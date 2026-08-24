import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Send, FileText, Video } from 'lucide-react';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { renderPreview, missingVariables } from '@/lib/template-render';
import { sendTemplate, type SendableTemplate } from '@/lib/wa-inbox';
import { cn } from '@/lib/utils';

/**
 * שליחת תבנית מאושרת ללקוח.
 *
 * 🔴 **זה מה שהיה חסר.** כשחלון 24 השעות נסגר, המסך אמר "אפשר לשלוח רק
 * תבנית מאושרת" ולא נתן דרך לשלוח אותה, אלא שלח את העובד לפריוריטי.
 * אבל רק תבנית שדורשת **מסמך חדש בכל הודעה** זקוקה לסשן של פריוריטי.
 * שאר התבניות נשלחות מכאן.
 *
 * ⭐ **התצוגה המקדימה היא הנוסח האמיתי.** מה שרואים כאן הוא מה שהלקוח
 * יקבל, כי שני הצדדים מחליפים את המשתנים באותו ביטוי בדיוק, ויש על כך
 * בדיקה שמשווה את שני הקבצים.
 *
 * 🔴 **הרשימה נמסרת מבחוץ ואינה נטענת כאן.** מי מכריע מה אפשר לשלוח
 * מאיפה הוא השרת, ב-`toPanelTemplates`, וגם החלונית שבתוך פריוריטי
 * קוראת את אותה רשימה מאותה נקודת קצה. ראה `SendableTemplate`.
 */

const VAR_LABELS: Record<string, string> = {
  customer_name: 'שם הלקוח',
  subject: 'הנושא',
  details: 'הפרטים',
  doc_type: 'סוג המסמך',
  doc_number: 'מספר המסמך',
  name: 'שם',
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  phone: string | null;
  customerName?: string;
  /** מה שהשרשור החזיר. undefined = השרשור עוד נטען. */
  templates?: SendableTemplate[];
  loading?: boolean;
  onSent?: () => void;
}

export function TemplateSendDialog({
  open, onOpenChange, phone, customerName, templates, loading, onSent,
}: Props) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);

  // 🔴 מסננים לפי `available`, ולא מציגים תבנית שמטא לא אישרה כאילו
  // אפשר לשלוח אותה. הסיבה חוזרת מהשרת ב-`unavailableReason`.
  const list = useMemo(() => (templates ?? []).filter((t) => t.available), [templates]);
  const selected: SendableTemplate | null =
    list.find((t) => t.key === selectedKey) ?? null;

  // ⭐ שם הלקוח כבר ידוע מהשיחה, ואין סיבה להקליד אותו מחדש.
  useEffect(() => {
    if (!open) return;
    setSelectedKey(null);
    setValues(customerName ? { customer_name: customerName, name: customerName } : {});
  }, [open, customerName]);

  const missing = selected ? missingVariables(selected.variables, values) : [];
  const preview = selected ? renderPreview(selected.preview, values) : '';

  async function send() {
    if (!selected || !phone || missing.length || sending) return;
    setSending(true);
    try {
      const payload: Record<string, string> = {};
      for (const n of selected.variables) payload[n] = values[n] ?? '';
      await sendTemplate(phone, selected.key, payload);
      toast.success('התבנית יצאה אל heyy. הסטטוס יתעדכן בשרשור.');
      onSent?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'השליחה נכשלה');
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>שליחת תבנית{customerName ? ` אל ${customerName}` : ''}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {loading && (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && list.length === 0 && (
            <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
              אין תבנית שאפשר לשלוח מכאן. תבניות מוצעות לצוות במסך תבניות הוואטסאפ.
            </p>
          )}

          {list.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs">התבנית</Label>
              <div className="grid gap-2">
                {list.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setSelectedKey(t.key)}
                    className={cn(
                      'rounded-lg border p-2.5 text-start transition',
                      selectedKey === t.key
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'hover:bg-muted/50',
                    )}
                  >
                    <span className="flex items-center gap-1.5 text-sm font-semibold">
                      {t.attachmentKind === 'video' ? (
                        <Video className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      {t.label}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-[11px] text-muted-foreground">
                      {t.preview}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {selected && selected.variables.length > 0 && (
            <div className="space-y-2">
              {selected.variables.map((v) => (
                <div key={v} className="space-y-1">
                  <Label htmlFor={`tv-${v}`} className="text-xs">
                    {VAR_LABELS[v] ?? v}
                  </Label>
                  <Input
                    id={`tv-${v}`}
                    value={values[v] ?? ''}
                    onChange={(e) => setValues((p) => ({ ...p, [v]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          )}

          {selected && (
            <div className="space-y-1">
              <Label className="text-xs">מה שהלקוח יקבל</Label>
              <div className="whitespace-pre-wrap rounded-lg bg-emerald-50 p-3 text-sm leading-relaxed">
                {preview}
              </div>
              {selected.attachmentKind === 'video' && (
                <p className="text-[11px] text-muted-foreground">
                  התבנית נושאת סרטון קבוע שאושר יחד איתה, והוא יישלח עם ההודעה.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>ביטול</Button>
          <Button disabled={!selected || missing.length > 0 || sending || !phone} onClick={send}>
            {sending ? (
              <Loader2 className="ms-1 h-4 w-4 animate-spin" />
            ) : (
              <Send className="ms-1 h-4 w-4" />
            )}
            {missing.length > 0 ? `חסר: ${missing.map((m) => VAR_LABELS[m] ?? m).join(', ')}` : 'שלח'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
