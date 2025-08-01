import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DataPoint {
  week: number;
  team1: number;
  team2?: number;
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

  const maxValue = Math.max(...data.flatMap(d => [d.team1, ...(d.team2 !== undefined ? [d.team2] : [])]));
  const minValue = Math.min(...data.flatMap(d => [d.team1, ...(d.team2 !== undefined ? [d.team2] : [])]));
  const range = maxValue - minValue;

  // Responsive chart dimensions
  const chartPadding = { left: 60, right: 40, top: 20, bottom: 40 };
  
  const getYPosition = (value: number) => {
    return ((maxValue - value) / range) * (height - chartPadding.top - chartPadding.bottom) + chartPadding.top;
  };

  const getXPosition = (index: number, chartWidth: number) => {
    const plotWidth = chartWidth - chartPadding.left - chartPadding.right;
    return (index / (data.length - 1)) * plotWidth + chartPadding.left;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Responsive container */}
        <div className="w-full">
          <div className="relative w-full overflow-x-auto">
            <div className="min-w-[500px] sm:min-w-[600px] md:min-w-[800px] lg:min-w-[1000px]">
              <svg 
                width="100%" 
                height={height + chartPadding.bottom + 20} 
                className="overflow-visible"
                viewBox={`0 0 ${Math.max(500, data.length * 70)} ${height + chartPadding.bottom + 20}`}
                preserveAspectRatio="xMidYMid meet"
              >
                {/* Grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
                  const y = chartPadding.top + ratio * (height - chartPadding.top - chartPadding.bottom);
                  const value = maxValue - ratio * range;
                  const chartWidth = Math.max(500, data.length * 70);
                  return (
                    <g key={index}>
                      <line
                        x1={chartPadding.left}
                        y1={y}
                        x2={chartWidth - chartPadding.right}
                        y2={y}
                        stroke="#e5e7eb"
                        strokeWidth="1"
                      />
                      <text
                        x={chartPadding.left - 10}
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
                  strokeWidth="3"
                  points={data
                    .map((d, i) => {
                      const chartWidth = Math.max(500, data.length * 70);
                      return `${getXPosition(i, chartWidth)},${getYPosition(d.team1)}`;
                    })
                    .join(' ')}
                />

                {/* Team 2 line - only render if team2 data exists */}
                {data.some(d => d.team2 !== undefined) && (
                  <polyline
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="3"
                    points={data
                      .filter(d => d.team2 !== undefined)
                      .map((d, i) => {
                        const chartWidth = Math.max(500, data.length * 70);
                        const originalIndex = data.indexOf(d);
                        return `${getXPosition(originalIndex, chartWidth)},${getYPosition(d.team2!)}`;
                      })
                      .join(' ')}
                  />
                )}

                {/* Data points */}
                {data.map((d, i) => {
                  const chartWidth = Math.max(500, data.length * 70);
                  return (
                    <g key={i}>
                      <circle
                        cx={getXPosition(i, chartWidth)}
                        cy={getYPosition(d.team1)}
                        r="5"
                        fill="#3b82f6"
                        stroke="#ffffff"
                        strokeWidth="2"
                      />
                      {d.team2 !== undefined && (
                        <circle
                          cx={getXPosition(i, chartWidth)}
                          cy={getYPosition(d.team2)}
                          r="5"
                          fill="#ef4444"
                          stroke="#ffffff"
                          strokeWidth="2"
                        />
                      )}
                      <text
                        x={getXPosition(i, chartWidth)}
                        y={height + chartPadding.bottom - 5}
                        textAnchor="middle"
                        className="text-xs fill-gray-500 font-medium"
                      >
                        W{d.week}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          {/* Centered Legend */}
          <div className="flex justify-center items-center space-x-8 mt-6 pt-4 border-t border-gray-100">
            <div className="flex items-center space-x-3">
              <div className="w-6 h-1 bg-blue-500 rounded-full"></div>
              <span className="text-sm font-medium text-gray-700">{team1Name}</span>
            </div>
            {data.some(d => d.team2 !== undefined) && (
              <div className="flex items-center space-x-3">
                <div className="w-6 h-1 bg-red-500 rounded-full"></div>
                <span className="text-sm font-medium text-gray-700">{team2Name}</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SimpleLineChart;