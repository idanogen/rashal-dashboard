import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Package, Minus, Plus } from 'lucide-react';

/**
 * הגדרות מסלול
 */
export interface RouteConfig {
  /** כמה נקודות אספקה */
  targetCount: number;
  /** כתובת התחלה (אופציונלי) */
  startingAddress?: string;
}

interface QuantityInputStepProps {
  /** כמה הזמנות זמינות */
  maxAvailable: number;
  /** קריאה חוזרת לאחר שליחה */
  onSubmit: (config: RouteConfig) => void;
}

/**
 * שלב 1: קלט כמות נקודות אספקה
 *
 * מאפשר למשתמש:
 * - לבחור כמה נקודות לספק מחר
 * - להזין כתובת התחלה (אופציונלי)
 */
export function QuantityInputStep({
  maxAvailable,
  onSubmit,
}: QuantityInputStepProps) {
  const defaultQuantity = Math.min(5, maxAvailable);
  const [quantity, setQuantity] = useState(defaultQuantity);
  const [startingAddress, setStartingAddress] = useState('');

  const handleQuantityChange = (value: string) => {
    const num = parseInt(value, 10);
    if (!isNaN(num)) {
      setQuantity(Math.max(1, Math.min(maxAvailable, num)));
    }
  };

  const handleIncrement = () => {
    setQuantity((prev) => Math.min(maxAvailable, prev + 1));
  };

  const handleDecrement = () => {
    setQuantity((prev) => Math.max(1, prev - 1));
  };

  const handleSubmit = () => {
    onSubmit({
      targetCount: quantity,
      startingAddress: startingAddress.trim() || undefined,
    });
  };

  return (
    <div className="space-y-6 py-4">
      {/* אייקון מרכזי */}
      <div className="flex items-center justify-center">
        <div className="rounded-full bg-primary/10 p-4">
          <Package className="h-8 w-8 text-primary" />
        </div>
      </div>

      {/* כותרת */}
      <div className="space-y-2 text-center">
        <h3 className="text-lg font-semibold">
          כמה נקודות אתה רוצה לספק מחר?
        </h3>
        <p className="text-sm text-muted-foreground">
          יש {maxAvailable} הזמנות ממתינות לתיאום
        </p>
      </div>

      {/* בורר כמות */}
      <div className="flex items-center justify-center gap-3">
        <Button
          variant="outline"
          size="icon"
          onClick={handleDecrement}
          disabled={quantity <= 1}
          className="h-10 w-10"
        >
          <Minus className="h-4 w-4" />
        </Button>

        <Input
          type="number"
          min={1}
          max={maxAvailable}
          value={quantity}
          onChange={(e) => handleQuantityChange(e.target.value)}
          className="w-24 text-center text-xl font-bold"
        />

        <Button
          variant="outline"
          size="icon"
          onClick={handleIncrement}
          disabled={quantity >= maxAvailable}
          className="h-10 w-10"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* שדה כתובת התחלה */}
      <div className="space-y-2">
        <Label htmlFor="starting-address" className="text-sm font-medium">
          נקודת התחלה (אופציונלי)
        </Label>
        <Input
          id="starting-address"
          type="text"
          placeholder="כתובת המחסן/משרד - למשל: רחוב הרצל 10, תל אביב"
          value={startingAddress}
          onChange={(e) => setStartingAddress(e.target.value)}
          className="text-sm"
        />
        <p className="text-xs text-muted-foreground">
          אם תשאיר ריק, המסלול יתחיל מההזמנה הראשונה
        </p>
      </div>

      {/* כפתור שליחה */}
      <Button onClick={handleSubmit} className="w-full" size="lg">
        צור מסלול מומלץ
      </Button>
    </div>
  );
}
