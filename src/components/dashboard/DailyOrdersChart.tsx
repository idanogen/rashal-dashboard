import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { BarChart3 } from 'lucide-react';
import type { Order } from '@/types/order';

interface DailyOrdersChartProps {
  orders: Order[];
}

export function DailyOrdersChart({ orders }: DailyOrdersChartProps) {
  const data = useMemo(() => {
    // Build last 14 days
    const days: { date: string; label: string; count: number }[] = [];
    const now = new Date();

    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dateStr = d.toISOString().split('T')[0]; // "2026-02-09"
      const label = `${d.getDate()}/${d.getMonth() + 1}`; // "9/2"
      days.push({ date: dateStr, label, count: 0 });
    }

    // Count orders per day
    for (const order of orders) {
      if (!order.created) continue;
      const day = days.find((d) => d.date === order.created);
      if (day) day.count++;
    }

    return days;
  }, [orders]);

  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <Card className="border shadow-sm">
      <CardContent className="p-4">
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-semibold">הזמנות לפי יום (14 ימים אחרונים)</h3>
        </div>
        <div className="h-[200px] w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                allowDecimals={false}
                domain={[0, maxCount + 1]}
                tick={{ fontSize: 11, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
                width={30}
              />
              <Tooltip
                formatter={(value: unknown) => [`${value} הזמנות`, 'כמות']}
                labelFormatter={(label: unknown) => `תאריך: ${label}`}
                contentStyle={{
                  fontFamily: 'Assistant, sans-serif',
                  fontSize: 12,
                  borderRadius: 8,
                  direction: 'rtl',
                }}
              />
              <Bar
                dataKey="count"
                fill="oklch(0.45 0.18 250)"
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
