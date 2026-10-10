import { useEffect, useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useUpdateStopDetails, type StopDetailsRef } from '@/hooks/useUpdateStopDetails';
import { buildStopDetailsPatch } from '@/lib/stop-details';
import type { CalendarStop } from '@/types/delivery';

/**
 * ⭐ עריכת כתובת, עיר וטלפון של עצירה משובצת (עמי, 07/10/2026: "כתובת
 * חדשה או נוספת, לפעמים הטיפול במסגרת").
 *
 * העצירה היא מה שהנהג רואה ונוסע אליו. הכתובת בפריוריטי לא משתנה, והדיאלוג
 * אומר את זה במילים כדי שאף אחד לא יצפה שהכרטיס בפריוריטי יתעדכן.
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
  const update = useUpdateStopDetails();
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (!open || !stop) return;
    setAddress(stop.address ?? '');
    setCity(stop.city ?? '');
    setPhone(stop.phone ?? '');
  }, [open, stop]);

  if (!stop) return null;
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
    await update.mutateAsync({ stop: ref, form: { address, city, phone } });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="sm:max-w-md">
        <DialogHeader className="text-start">
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            עריכת פרטי העצירה
          </DialogTitle>
          <DialogDescription className="text-start">
            {stop.customerName}. מה שכתוב כאן הוא מה שהנהג רואה ונוסע אליו. הכתובת והטלפון בפריוריטי לא משתנים.
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
            <p className="text-[11px] text-muted-foreground">
              המספר שהנהג מתקשר אליו מהעצירה הזאת. טלפון נוסף קבוע ללקוח מוסיפים בכרטיס הלקוח או בפרטי הקריאה.
            </p>
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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={update.isPending}>
            ביטול
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
