import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { BarChart3 } from 'lucide-react';
import type { ServiceCall } from '@/types/service-call';

interface DailyServiceCallsChartProps {
  calls: ServiceCall[];
}

export function DailyServiceCallsChart({ calls }: DailyServiceCallsChartProps) {
  const data = useMemo(() => {
    const days: { date: string; label: string; count: number }[] = [];
    const now = new Date();

    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const label = `${d.getDate()}/${d.getMonth() + 1}`;
      days.push({ date: dateStr, label, count: 0 });
    }

    for (const call of calls) {
      if (!call.created) continue;
      const callDate = call.created.split('T')[0];
      const day = days.find((d) => d.date === callDate);
      if (day) day.count++;
    }

    return days;
  }, [calls]);

  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <Card className="border shadow-sm">
      <CardContent className="p-4">
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-purple-600" />
          <h3 className="text-sm font-semibold">קריאות שירות לפי יום (14 ימים אחרונים)</h3>
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
                formatter={(value: unknown) => [`${value} קריאות`, 'כמות']}
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
                fill="#8b5cf6"
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
