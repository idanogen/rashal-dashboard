import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DRIVERS, type DriverName } from '@/types/route';
import { ClipboardList } from 'lucide-react';

interface TaskDialogProps {
  open: boolean;
  onClose: () => void;
  date: string | null;
  onSubmit: (data: {
    driver: DriverName;
    customerName: string;
    address?: string;
    city?: string;
    phone?: string;
    notes?: string;
  }) => void;
}

export function TaskDialog({ open, onClose, date, onSubmit }: TaskDialogProps) {
  const [driver, setDriver] = useState<DriverName>(DRIVERS[0]);
  const [customerName, setCustomerName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) {
      setDriver(DRIVERS[0]);
      setCustomerName('');
      setAddress('');
      setCity('');
      setPhone('');
      setNotes('');
    }
  }, [open]);

  const handleSubmit = () => {
    if (!customerName.trim()) return;
    onSubmit({
      driver,
      customerName: customerName.trim(),
      address: address.trim() || undefined,
      city: city.trim() || undefined,
      phone: phone.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  const dateLabel = date
    ? new Date(date + 'T00:00:00').toLocaleDateString('he-IL', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
      })
    : '';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-amber-600" />
            משימה חדשה לנהג
          </DialogTitle>
          {dateLabel && (
            <p className="text-xs text-muted-foreground">{dateLabel}</p>
          )}
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="task-driver" className="text-xs">
              נהג
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {DRIVERS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDriver(d)}
                  className={`rounded-lg border px-3 py-2 text-sm transition-all ${
                    driver === d
                      ? 'border-primary bg-primary/10 font-semibold'
                      : 'hover:bg-muted'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-customer" className="text-xs">
              שם הלקוח / תיאור המשימה *
            </Label>
            <Input
              id="task-customer"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="לדוגמה: איסוף ציוד מהספק"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="task-city" className="text-xs">
                עיר
              </Label>
              <Input
                id="task-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-phone" className="text-xs">
                טלפון
              </Label>
              <Input
                id="task-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                dir="ltr"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-address" className="text-xs">
              כתובת
            </Label>
            <Input
              id="task-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-notes" className="text-xs">
              הערות
            </Label>
            <Input
              id="task-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={onClose}>
            ביטול
          </Button>
          <Button onClick={handleSubmit} disabled={!customerName.trim()}>
            הוסף ליומן
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
