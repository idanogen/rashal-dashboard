import { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ArrowRight,
  Check,
  Phone,
  MapPin,
  Navigation as NavigationIcon,
  Home,
  Pencil,
  X,
} from 'lucide-react';
import type { Order } from '@/types/order';
import { MapView } from '@/components/route-navigation/MapView';
import { DraggableRouteList } from '@/components/tomorrow-coordination/DraggableRouteList';
import { AvailableOrdersPanel } from '@/components/tomorrow-coordination/AvailableOrdersPanel';
import { useOrders } from '@/hooks/useOrders';

/**
 * דף ניהול מסלול משלוחים
 *
 * מאפשר:
 * - תצוגת מפה (בשלב הבא)
 * - מעקב אחר התקדמות
 * - ניווט צעד-אחר-צעד
 * - סימון הזמנות כהושלמו
 */
export function RouteNavigationPage() {
  const location = useLocation();
  const navigate = useNavigate();

  // קבלת המסלול מה-state של הנתב
  const initialRoute = (location.state?.route as Order[]) || [];
  const routeName = location.state?.routeName as string | undefined;

  // State - מסלול
  const [routeOrders, setRouteOrders] = useState<Order[]>(initialRoute);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());

  // State - מצב עריכה
  const [isEditMode, setIsEditMode] = useState(false);
  const [tempRoute, setTempRoute] = useState<Order[]>(routeOrders);

  // שליפת כל ההזמנות מ-Airtable (לצורך הוספה במצב עריכה)
  const { data: allOrders = [] } = useOrders();

  // סינון הזמנות זמינות - רק "ממתין לתאום"
  const availableOrders = useMemo(() => {
    return allOrders.filter(
      (o) =>
        o.orderStatus === 'ממתין לתאום' &&
        o.address &&
        o.city
    );
  }, [allOrders]);

  // אם אין מסלול, חזור לדף הראשי
  useEffect(() => {
    if (initialRoute.length === 0) {
      navigate('/');
    }
  }, [initialRoute.length, navigate]);

  if (routeOrders.length === 0) {
    return null;
  }

  const currentOrder = routeOrders[currentIndex];
  const completedCount = completedIds.size;
  const totalCount = routeOrders.length;

  const handleComplete = () => {
    // סמן כהושלם
    setCompletedIds((prev) => new Set(prev).add(currentOrder.id));

    // עבור להזמנה הבאה
    if (currentIndex < routeOrders.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleJumpTo = (index: number) => {
    setCurrentIndex(index);
  };

  const handleBackToDashboard = () => {
    navigate('/');
  };

  // מצב עריכה - כניסה
  const handleEnterEditMode = () => {
    setTempRoute([...routeOrders]); // copy
    setIsEditMode(true);
  };

  // מצב עריכה - שמירה
  const handleSaveEdit = () => {
    // שמירת ה-orderId של ההזמנה הנוכחית
    const currentOrderId = routeOrders[currentIndex]?.id;

    // עדכון המסלול
    setRouteOrders(tempRoute);

    // מציאת האינדקס החדש של אותה הזמנה
    if (currentOrderId) {
      const newIndex = tempRoute.findIndex(o => o.id === currentOrderId);
      setCurrentIndex(newIndex >= 0 ? newIndex : 0);
    }

    // יציאה ממצב עריכה
    setIsEditMode(false);
  };

  // מצב עריכה - ביטול
  const handleCancelEdit = () => {
    setTempRoute([...routeOrders]); // reset
    setIsEditMode(false);
  };

  // מצב עריכה - הוספת הזמנה
  const handleAddOrder = (orderId: string) => {
    const orderToAdd = availableOrders.find(o => o.id === orderId);
    if (orderToAdd && !tempRoute.find(o => o.id === orderId)) {
      setTempRoute(prev => [...prev, orderToAdd]);
    }
  };

  // מצב עריכה - הסרת הזמנה
  const handleRemoveOrder = (orderId: string) => {
    setTempRoute(prev => prev.filter(o => o.id !== orderId));
  };

  // פתיחת Waze עם הכתובת הנוכחית
  const handleOpenWaze = () => {
    const address = `${currentOrder.address}, ${currentOrder.city}`;
    const wazeUrl = `https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`;
    window.open(wazeUrl, '_blank');
  };

  // פתיחת Google Maps עם הכתובת הנוכחית
  const handleOpenGoogleMaps = () => {
    const address = `${currentOrder.address}, ${currentOrder.city}`;
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
    window.open(mapsUrl, '_blank');
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="border-b bg-background p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">מסלול משלוחים</h1>
            {routeName && (
              <p className="text-sm text-muted-foreground">{routeName}</p>
            )}
          </div>
          <div className="flex items-center gap-4">
            <Badge variant="secondary" className="text-lg px-4 py-2">
              {completedCount}/{totalCount} הושלמו
            </Badge>

            {/* כפתור עריכה */}
            {!isEditMode && (
              <Button
                onClick={handleEnterEditMode}
                variant="outline"
                className="gap-2"
              >
                <Pencil className="h-4 w-4" />
                ערוך מסלול
              </Button>
            )}

            <Button
              onClick={handleBackToDashboard}
              variant="outline"
              className="gap-2"
            >
              <Home className="h-4 w-4" />
              חזרה לדשבורד
            </Button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{
                width: `${(completedCount / totalCount) * 100}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Interactive Map */}
        <div className="hidden flex-1 border-l md:flex">
          <MapView
            route={routeOrders}
            currentIndex={currentIndex}
            completedIds={completedIds}
          />
        </div>

        {/* Right Panel - Current Order & List */}
        <div className="w-full md:w-[400px] lg:w-[500px] flex flex-col overflow-hidden">
          {!isEditMode ? (
            // מצב רגיל - Navigation
            <>
              <div className="border-b p-4 bg-primary/5">
                <Card className="border-primary/50">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>הזמנה נוכחית</span>
                      <Badge variant="default" className="text-lg">
                        #{currentIndex + 1}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
              <CardContent className="space-y-4">
                {/* Customer Info */}
                <div>
                  <p className="text-lg font-bold">{currentOrder.customerName}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    <MapPin className="inline h-3 w-3 ml-1" />
                    {currentOrder.address}, {currentOrder.city}
                  </p>
                  {currentOrder.phone && (
                    <a
                      href={`tel:${currentOrder.phone}`}
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-2"
                    >
                      <Phone className="h-3 w-3" />
                      {currentOrder.phone}
                    </a>
                  )}
                </div>

                {/* Navigation Buttons */}
                <div className="space-y-2">
                  <Button
                    onClick={handleOpenWaze}
                    variant="default"
                    className="w-full gap-2"
                    size="lg"
                  >
                    <NavigationIcon className="h-4 w-4" />
                    פתח ב-Waze
                  </Button>

                  <Button
                    onClick={handleOpenGoogleMaps}
                    variant="outline"
                    className="w-full gap-2"
                  >
                    <NavigationIcon className="h-4 w-4" />
                    פתח ב-Google Maps
                  </Button>

                  <Button
                    onClick={handleComplete}
                    variant="default"
                    className="w-full gap-2 bg-green-600 hover:bg-green-700"
                    size="lg"
                    disabled={completedIds.has(currentOrder.id)}
                  >
                    {completedIds.has(currentOrder.id) ? (
                      <>
                        <Check className="h-5 w-5" />
                        הושלם
                      </>
                    ) : (
                      <>
                        <Check className="h-5 w-5" />
                        סיימתי - הבא
                      </>
                    )}
                  </Button>
                </div>

                {/* Previous/Next */}
                <div className="flex gap-2">
                  <Button
                    onClick={handlePrevious}
                    disabled={currentIndex === 0}
                    variant="outline"
                    className="flex-1"
                  >
                    ← הקודם
                  </Button>
                  <Button
                    onClick={() => handleJumpTo(currentIndex + 1)}
                    disabled={currentIndex === routeOrders.length - 1}
                    variant="outline"
                    className="flex-1"
                  >
                    הבא →
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Orders List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            <h3 className="text-sm font-semibold mb-2">כל ההזמנות</h3>
            {routeOrders.map((order, index) => {
              const isCompleted = completedIds.has(order.id);
              const isCurrent = index === currentIndex;

              return (
                <button
                  key={order.id}
                  onClick={() => handleJumpTo(index)}
                  className={`
                    w-full text-right p-3 rounded-lg border transition-all
                    ${isCurrent ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/30'}
                    ${isCompleted ? 'opacity-60' : ''}
                  `}
                >
                  <div className="flex items-center gap-3">
                    {/* Status Icon */}
                    <div
                      className={`
                        flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold
                        ${isCompleted ? 'bg-green-500 text-white' : isCurrent ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}
                      `}
                    >
                      {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
                    </div>

                    {/* Order Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">
                        {order.customerName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {order.city}
                      </p>
                    </div>

                    {/* Arrow for current */}
                    {isCurrent && (
                      <ArrowRight className="h-4 w-4 shrink-0 text-primary" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        // מצב עריכה
        <>
          <div className="border-b p-4 bg-orange-50">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">עריכת מסלול</h3>
              <div className="flex gap-2">
                <Button
                  onClick={handleCancelEdit}
                  variant="ghost"
                  size="sm"
                >
                  <X className="h-4 w-4 ml-1" />
                  ביטול
                </Button>
                <Button
                  onClick={handleSaveEdit}
                  size="sm"
                >
                  <Check className="h-4 w-4 ml-1" />
                  שמור
                </Button>
              </div>
            </div>
          </div>

          {/* תוכן עריכה */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              {/* רשימת המסלול */}
              <div>
                <h4 className="text-sm font-semibold mb-2">
                  המסלול שלי ({tempRoute.length} עצירות)
                </h4>
                {tempRoute.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    המסלול ריק. הוסף הזמנות מהרשימה למטה
                  </div>
                ) : (
                  <DraggableRouteList
                    orders={tempRoute}
                    onReorder={setTempRoute}
                    onRemove={handleRemoveOrder}
                  />
                )}
              </div>

              {/* הזמנות זמינות */}
              <div>
                <h4 className="text-sm font-semibold mb-2">הוסף הזמנות</h4>
                <div className="max-h-[300px]">
                  <AvailableOrdersPanel
                    orders={availableOrders}
                    selectedIds={tempRoute.map(o => o.id)}
                    onAdd={handleAddOrder}
                  />
                </div>
              </div>
            </div>
          </div>
        </>
      )}
        </div>
      </div>
    </div>
  );
}
