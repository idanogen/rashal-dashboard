import { useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useUpdateStopDetails, type StopDetailsRef } from '@/hooks/useUpdateStopDetails';
import { SCOPE_OPTIONS, buildStopDetailsPatch, type StopDetailsScope } from '@/lib/stop-details';
import { cn } from '@/lib/utils';
import type { CalendarStop } from '@/types/delivery';

/**
 * ⭐ עריכת כתובת, עיר וטלפון של עצירה משובצת (עמי, 07/10/2026: "כתובת
 * חדשה או נוספת, לפעמים הטיפול במסגרת").
 *
 * 28/10/2026 (עידן): בשמירה בוחרים היקף. חד פעמי = רק העצירה. קבוע = גם
 * הביקורים הפתוחים של הלקוח, ובפריוריטי הוספה בלבד (איש קשר ושורה בכרטיס),
 * הכתובת בכרטיס לא נדרסת. על כל שמירה יוצא מייל למשרד.
 */
export function EditStopDetailsDialog({
  stop,
  open,
  onOpenChange,
}: {
  stop: CalendarStop | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!stop) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="sm:max-w-md">
        {/* המפתח מאפס את הטופס לכל עצירה ולכל פתיחה, בלי useEffect שמעדכן state. */}
        <EditStopDetailsForm key={`${stop.stopId}:${open ? 1 : 0}`} stop={stop} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function EditStopDetailsForm({ stop, onClose }: { stop: CalendarStop; onClose: () => void }) {
  const update = useUpdateStopDetails();
  const [address, setAddress] = useState(stop.address ?? '');
  const [city, setCity] = useState(stop.city ?? '');
  const [phone, setPhone] = useState(stop.phone ?? '');
  const [scope, setScope] = useState<StopDetailsScope>('once');
  const patch = buildStopDetailsPatch(stop, { address, city, phone });

  const save = async () => {
    const ref: StopDetailsRef = {
      stopId: stop.stopId,
      sourceId: stop.sourceId,
      sourceType: stop.sourceType,
      address: stop.address,
      city: stop.city,
      phone: stop.phone,
    };
    await update.mutateAsync({ stop: ref, form: { address, city, phone }, scope });
    onClose();
  };

  return (
    <>
      <DialogHeader className="text-start">
        <DialogTitle className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          עריכת פרטי העצירה
        </DialogTitle>
        <DialogDescription className="text-start">
          {stop.customerName}. מה שכתוב כאן הוא מה שהנהג רואה ונוסע אליו. על כל שינוי יוצא מייל למשרד.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-3">
        <div className="grid gap-1">
          <Label htmlFor="stop-address">כתובת</Label>
          <Input
            id="stop-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="רחוב ומספר, או שם המוסד"
            className="h-10 text-[16px] sm:text-sm"
            autoFocus
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="stop-city">עיר</Label>
          <Input id="stop-city" value={city} onChange={(e) => setCity(e.target.value)} className="h-10 text-[16px] sm:text-sm" />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="stop-phone">טלפון לעצירה</Label>
          <Input
            id="stop-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            dir="ltr"
            className="h-10 text-[16px] sm:text-sm"
          />
        </div>

        <div className="grid gap-1.5" role="radiogroup" aria-label="היקף השינוי">
          <Label>השינוי הזה הוא</Label>
          <div className="grid grid-cols-2 gap-2">
            {SCOPE_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={scope === o.value}
                onClick={() => setScope(o.value)}
                className={cn(
                  'rounded-md border px-3 py-2 text-start text-sm transition-colors',
                  scope === o.value ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-input hover:bg-muted/50',
                )}
              >
                <div className="font-medium">{o.label}</div>
                <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{o.hint}</div>
              </button>
            ))}
          </div>
        </div>

        {patch.relocate && (
          <p className="rounded-md bg-amber-50 px-2.5 py-1.5 text-[12px] text-amber-800">
            הכתובת השתנתה: הסיכה על המפה תזוז למקום החדש אחרי השמירה.
          </p>
        )}
      </div>

      <DialogFooter className="gap-2 sm:justify-start">
        <Button onClick={save} disabled={patch.empty || update.isPending} className="gap-1.5">
          {update.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          שמור
        </Button>
        <Button variant="outline" onClick={onClose} disabled={update.isPending}>
          ביטול
        </Button>
      </DialogFooter>
    </>
  );
}
