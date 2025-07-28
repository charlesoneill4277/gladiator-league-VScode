import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DataPoint {
  week: number;
  team1: number;
  team2: number;
}

interface SimpleLineChartProps {
  title: string;
  data: DataPoint[];
  team1Name: string;
  team2Name: string;
  height?: number;
}

const SimpleLineChart: React.FC<SimpleLineChartProps> = ({
  title,
  data,
  team1Name,
  team2Name,
  height = 200
}) => {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-48 text-muted-foreground">
            No data available
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxValue = Math.max(...data.flatMap(d => [d.team1, d.team2]));
  const minValue = Math.min(...data.flatMap(d => [d.team1, d.team2]));
  const range = maxValue - minValue;

  const getYPosition = (value: number) => {
    return ((maxValue - value) / range) * (height - 40) + 20;
  };

  const getXPosition = (index: number) => {
    return (index / (data.length - 1)) * 300 + 50;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative" style={{ height: height + 60 }}>
          <svg width="400" height={height + 40} className="overflow-visible">
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
              const y = 20 + ratio * (height - 40);
              const value = maxValue - ratio * range;
              return (
                <g key={index}>
                  <line
                    x1="50"
                    y1={y}
                    x2="350"
                    y2={y}
                    stroke="#e5e7eb"
                    strokeWidth="1"
                  />
                  <text
                    x="45"
                    y={y + 4}
                    textAnchor="end"
                    className="text-xs fill-gray-500"
                  >
                    {value.toFixed(0)}
                  </text>
                </g>
              );
            })}

            {/* Team 1 line */}
            <polyline
              fill="none"
              stroke="#3b82f6"
              strokeWidth="2"
              points={data
                .map((d, i) => `${getXPosition(i)},${getYPosition(d.team1)}`)
                .join(' ')}
            />

            {/* Team 2 line */}
            <polyline
              fill="none"
              stroke="#ef4444"
              strokeWidth="2"
              points={data
                .map((d, i) => `${getXPosition(i)},${getYPosition(d.team2)}`)
                .join(' ')}
            />

            {/* Data points */}
            {data.map((d, i) => (
              <g key={i}>
                <circle
                  cx={getXPosition(i)}
                  cy={getYPosition(d.team1)}
                  r="4"
                  fill="#3b82f6"
                />
                <circle
                  cx={getXPosition(i)}
                  cy={getYPosition(d.team2)}
                  r="4"
                  fill="#ef4444"
                />
                <text
                  x={getXPosition(i)}
                  y={height + 35}
                  textAnchor="middle"
                  className="text-xs fill-gray-500"
                >
                  W{d.week}
                </text>
              </g>
            ))}
          </svg>

          {/* Legend */}
          <div className="flex justify-center space-x-6 mt-4">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-0.5 bg-blue-500"></div>
              <span className="text-sm text-gray-600">{team1Name}</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-0.5 bg-red-500"></div>
              <span className="text-sm text-gray-600">{team2Name}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SimpleLineChart;