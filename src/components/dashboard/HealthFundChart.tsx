import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Building2 } from 'lucide-react';
import type { Order } from '@/types/order';

interface HealthFundChartProps {
  orders: Order[];
}

const COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#ef4444', // red
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#f97316', // orange
];

export function HealthFundChart({ orders }: HealthFundChartProps) {
  const data = useMemo(() => {
    const counts: Record<string, number> = {};

    for (const order of orders) {
      const fund = order.healthFund || 'לא צוין';
      counts[fund] = (counts[fund] || 0) + 1;
    }

    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [orders]);

  if (data.length === 0) return null;

  return (
    <Card className="border shadow-sm">
      <CardContent className="p-4">
        <div className="mb-4 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-semibold">פילוח לפי קופת חולים</h3>
        </div>
        <div className="h-[200px] w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={75}
                paddingAngle={2}
                dataKey="value"
              >
                {data.map((_entry, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: unknown) => [`${value} הזמנות`, '']}
                contentStyle={{
                  fontFamily: 'Assistant, sans-serif',
                  fontSize: 12,
                  borderRadius: 8,
                  direction: 'rtl',
                }}
              />
              <Legend
                layout="vertical"
                align="right"
                verticalAlign="middle"
                iconSize={10}
                wrapperStyle={{ fontSize: 11, direction: 'rtl', paddingRight: 10 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
