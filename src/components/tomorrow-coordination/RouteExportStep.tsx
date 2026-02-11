import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  CheckCircle2,
  ExternalLink,
  Download,
  MapPin,
  Navigation,
} from 'lucide-react';
import type { Order } from '@/types/order';

interface RouteExportStepProps {
  /** רשימת הזמנות סופית */
  route: Order[];
  /** סה"כ מרחק משוער */
  totalDistance?: number;
  /** קריאה חוזרת לייצוא CSV */
  onExportCSV: () => void;
  /** קריאה חוזרת לפתיחת Google Maps */
  onOpenMaps: () => void;
}

/**
 * שלב 4: ייצוא ופעולות
 *
 * מציג:
 * - סיכום המסלול
 * - כפתורים לייצוא CSV ו-Google Maps
 */
export function RouteExportStep({
  route,
  totalDistance,
  onExportCSV,
  onOpenMaps,
}: RouteExportStepProps) {
  const navigate = useNavigate();
  const [csvExported, setCsvExported] = useState(false);

  const handleExportCSV = () => {
    onExportCSV();
    setCsvExported(true);

    // איפוס ההודעה אחרי 3 שניות
    setTimeout(() => setCsvExported(false), 3000);
  };

  const handleStartNavigation = () => {
    // מעבר לדף ניהול המסלול עם ה-route ב-state
    navigate('/route-navigation', {
      state: {
        route,
        routeName: `מסלול ${new Date().toLocaleDateString('he-IL')}`,
      },
    });
  };

  return (
    <div className="space-y-6 py-4">
      {/* אייקון הצלחה */}
      <div className="flex items-center justify-center">
        <div className="rounded-full bg-green-100 p-4">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
      </div>

      {/* כותרת */}
      <div className="space-y-2 text-center">
        <h3 className="text-lg font-semibold">המסלול מוכן!</h3>
        <div className="flex items-center justify-center gap-2">
          <Badge variant="secondary" className="text-sm">
            {route.length} עצירות
          </Badge>
          {totalDistance && totalDistance > 0 && (
            <Badge variant="outline" className="text-sm">
              ~{totalDistance} ק״מ
            </Badge>
          )}
        </div>
      </div>

      {/* סיכום המסלול */}
      <Card>
        <CardContent className="p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <MapPin className="h-4 w-4 text-primary" />
            <span>סיכום המסלול</span>
          </div>

          <div className="max-h-[300px] space-y-1 overflow-y-auto text-sm">
            {route.map((order, index) => (
              <div
                key={order.id}
                className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/30"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {order.customerName}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {order.city}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* פעולות */}
      <div className="space-y-3">
        {/* כפתור ראשי - התחל ניווט */}
        <Button
          onClick={handleStartNavigation}
          className="w-full gap-2"
          size="lg"
        >
          <Navigation className="h-5 w-5" />
          התחל ניווט במערכת
        </Button>

        {/* כפתורים משניים */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={onOpenMaps}
            variant="outline"
            className="gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            Google Maps
          </Button>

          <Button
            onClick={handleExportCSV}
            variant="outline"
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            {csvExported ? '✓' : 'CSV'}
          </Button>
        </div>

        {/* הודעת הצלחה */}
        {csvExported && (
          <p className="text-center text-sm text-green-600">
            הקובץ נשמר בתיקיית ההורדות שלך
          </p>
        )}
      </div>

      {/* טיפ */}
      <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
        <p className="font-semibold">💡 טיפ:</p>
        <p className="mt-1 text-xs">
          פתח את המסלול ב-Google Maps ושמור אותו בטלפון שלך לניווט בזמן
          אמת. את קובץ ה-CSV תוכל לשתף עם חברי הצוות או לשמור לתיעוד.
        </p>
      </div>
    </div>
  );
}
