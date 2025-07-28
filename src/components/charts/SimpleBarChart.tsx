import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DataPoint {
  label: string;
  value: number;
  color?: string;
}

interface SimpleBarChartProps {
  title: string;
  data: DataPoint[];
  maxValue?: number;
  height?: number;
}

const SimpleBarChart: React.FC<SimpleBarChartProps> = ({
  title,
  data,
  maxValue,
  height = 200
}) => {
  const max = maxValue || Math.max(...data.map(d => d.value));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3" style={{ height }}>
          {data.map((item, index) => (
            <div key={index} className="flex items-center space-x-3">
              <div className="w-16 text-sm text-right shrink-0">
                {item.label}
              </div>
              <div className="flex-1 relative">
                <div className="w-full bg-gray-200 rounded-full h-6">
                  <div
                    className={`h-6 rounded-full flex items-center justify-end pr-2 text-white text-xs font-medium ${
                      item.color || 'bg-blue-500'
                    }`}
                    style={{ width: `${(item.value / max) * 100}%` }}
                  >
                    {item.value.toFixed(1)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default SimpleBarChart;