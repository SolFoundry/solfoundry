import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area } from 'recharts';

interface TokenDistributionData {
  name: string;
  value: number;
  color: string;
}

interface BuybackFlowData {
  phase: string;
  amount: number;
  cumulative: number;
}

interface TokenomicsChartsProps {
  distributionData: TokenDistributionData[];
  buybackData: BuybackFlowData[];
  className?: string;
}

const RADIAN = Math.PI / 180;

const renderCustomizedLabel = ({
  cx, cy, midAngle, innerRadius, outerRadius, percent
}: any) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  if (percent < 0.05) return null;

  return (
    <text 
      x={x} 
      y={y} 
      fill="white" 
      textAnchor={x > cx ? 'start' : 'end'} 
      dominantBaseline="central"
      className="text-sm font-medium"
    >
      {`${(percent * 100).toFixed(1)}%`}
    </text>
  );
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-lg">
        <p className="text-gray-300 text-sm">{data.name}</p>
        <p className="text-white font-semibold">
          {data.value.toLocaleString()} tokens ({((data.value / distributionData.reduce((sum: number, item: any) => sum + item.value, 0)) * 100).toFixed(1)}%)
        </p>
      </div>
    );
  }
  return null;
};

const BuybackTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-lg">
        <p className="text-gray-300 text-sm">{`Phase: ${label}`}</p>
        <p className="text-blue-400 font-semibold">
          {`Buyback: ${payload[0].value.toLocaleString()} tokens`}
        </p>
        {payload[1] && (
          <p className="text-green-400 font-semibold">
            {`Cumulative: ${payload[1].value.toLocaleString()} tokens`}
          </p>
        )}
      </div>
    );
  }
  return null;
};

let distributionData: TokenDistributionData[] = [];

export const TokenDistributionChart: React.FC<{ data: TokenDistributionData[]; className?: string }> = ({ data, className = '' }) => {
  distributionData = data;
  
  return (
    <div className={`bg-gray-800 rounded-xl p-6 ${className}`}>
      <h3 className="text-xl font-bold text-white mb-4">Token Distribution</h3>
      <ResponsiveContainer width="100%" height={400}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomizedLabel}
            outerRadius={120}
            fill="#8884d8"
            dataKey="value"
            animationBegin={0}
            animationDuration={800}
            animationEasing="ease-out"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            verticalAlign="bottom" 
            height={36}
            wrapperStyle={{ color: '#fff', fontSize: '14px' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export const BuybackFlowChart: React.FC<{ data: BuybackFlowData[]; className?: string }> = ({ data, className = '' }) => {
  return (
    <div className={`bg-gray-800 rounded-xl p-6 ${className}`}>
      <h3 className="text-xl font-bold text-white mb-4">Buyback Flow</h3>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis 
            dataKey="phase" 
            tick={{ fill: '#D1D5DB', fontSize: 12 }}
            stroke="#6B7280"
          />
          <YAxis 
            tick={{ fill: '#D1D5DB', fontSize: 12 }}
            stroke="#6B7280"
          />
          <Tooltip content={<BuybackTooltip />} />
          <Bar 
            dataKey="amount" 
            fill="#3B82F6" 
            name="Buyback Amount"
            animationDuration={800}
            animationEasing="ease-out"
          />
          <Bar 
            dataKey="cumulative" 
            fill="#10B981" 
            name="Cumulative"
            animationDuration={1000}
            animationEasing="ease-out"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export const TokenomicsFlow: React.FC<{ data: BuybackFlowData[]; className?: string }> = ({ data, className = '' }) => {
  return (
    <div className={`bg-gray-800 rounded-xl p-6 ${className}`}>
      <h3 className="text-xl font-bold text-white mb-4">Token Flow Timeline</h3>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis 
            dataKey="phase" 
            tick={{ fill: '#D1D5DB', fontSize: 12 }}
            stroke="#6B7280"
          />
          <YAxis 
            tick={{ fill: '#D1D5DB', fontSize: 12 }}
            stroke="#6B7280"
          />
          <Tooltip content={<BuybackTooltip />} />
          <Area
            type="monotone"
            dataKey="cumulative"
            stroke="#10B981"
            fill="url(#colorCumulative)"
            animationDuration={1200}
            animationEasing="ease-out"
          />
          <defs>
            <linearGradient id="colorCumulative" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#10B981" stopOpacity={0.1}/>
            </linearGradient>
          </defs>
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

const TokenomicsCharts: React.FC<TokenomicsChartsProps> = ({ distributionData, buybackData, className = '' }) => {
  return (
    <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 ${className}`}>
      <TokenDistributionChart data={distributionData} />
      <BuybackFlowChart data={buybackData} />
      <div className="lg:col-span-2">
        <TokenomicsFlow data={buybackData} />
      </div>
    </div>
  );
};

export default TokenomicsCharts;