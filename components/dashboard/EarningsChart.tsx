import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface EarningsData {
  date: string;
  earnings: number;
}

interface EarningsChartProps {
  data?: EarningsData[];
}

const defaultData: EarningsData[] = [
  { date: '2024-01-01', earnings: 120 },
  { date: '2024-01-02', earnings: 150 },
  { date: '2024-01-03', earnings: 180 },
  { date: '2024-01-04', earnings: 140 },
  { date: '2024-01-05', earnings: 200 },
  { date: '2024-01-06', earnings: 250 },
  { date: '2024-01-07', earnings: 220 },
  { date: '2024-01-08', earnings: 300 },
  { date: '2024-01-09', earnings: 280 },
  { date: '2024-01-10', earnings: 320 },
  { date: '2024-01-11', earnings: 290 },
  { date: '2024-01-12', earnings: 350 },
  { date: '2024-01-13', earnings: 400 },
  { date: '2024-01-14', earnings: 380 },
  { date: '2024-01-15', earnings: 420 },
  { date: '2024-01-16', earnings: 390 },
  { date: '2024-01-17', earnings: 450 },
  { date: '2024-01-18', earnings: 480 },
  { date: '2024-01-19', earnings: 460 },
  { date: '2024-01-20', earnings: 500 },
  { date: '2024-01-21', earnings: 520 },
  { date: '2024-01-22', earnings: 490 },
  { date: '2024-01-23', earnings: 550 },
  { date: '2024-01-24', earnings: 580 },
  { date: '2024-01-25', earnings: 560 },
  { date: '2024-01-26', earnings: 600 },
  { date: '2024-01-27', earnings: 620 },
  { date: '2024-01-28', earnings: 590 },
  { date: '2024-01-29', earnings: 650 },
  { date: '2024-01-30', earnings: 680 }
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const date = new Date(label).toLocaleDateString();
    return (
      <div className="bg-white p-3 border border-gray-300 rounded-lg shadow-lg">
        <p className="text-sm text-gray-600">{date}</p>
        <p className="text-lg font-semibold text-green-600">
          ${payload[0].value.toFixed(2)}
        </p>
      </div>
    );
  }
  return null;
};

const EarningsChart: React.FC<EarningsChartProps> = ({ data = defaultData }) => {
  const formatXAxisDate = (tickItem: string) => {
    const date = new Date(tickItem);
    return date.getDate().toString();
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Earnings Over Last 30 Days</h3>
        <p className="text-sm text-gray-600">Daily earnings trend</p>
      </div>
      
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 20,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="date"
              tickFormatter={formatXAxisDate}
              stroke="#666"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#666"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `$${value}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="earnings"
              stroke="#10b981"
              strokeWidth={3}
              dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: '#10b981', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      <div className="mt-4 flex justify-between items-center text-sm text-gray-600">
        <span>Total: ${data.reduce((sum, item) => sum + item.earnings, 0).toFixed(2)}</span>
        <span>Avg: ${(data.reduce((sum, item) => sum + item.earnings, 0) / data.length).toFixed(2)}/day</span>
      </div>
    </div>
  );
};

export default EarningsChart;