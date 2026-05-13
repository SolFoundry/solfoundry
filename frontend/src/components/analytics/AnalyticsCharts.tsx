import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, LineChart, Line, ComposedChart
} from 'recharts';
import { fadeIn } from '../../lib/animations';

interface AnalyticsChartsProps {
  timeRange: string;
}

export const generateTimeSeriesData = (days: number) => {
  const data = [];
  const now = new Date();
  
  let baseVolume = 10000;
  let baseBounties = 5;
  let baseContributors = 2;

  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    // Deterministic random so charts and CSV match based on date
    const seed = date.getDate() + date.getMonth() * 31;
    const noise = (seed % 40) / 100 + 0.8; // 0.8 to 1.19
    const trend = 1 + ((days - i) / days) * 0.5;
    
    data.push({
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      volume: Math.floor(baseVolume * noise * trend),
      bounties: Math.floor(baseBounties * noise * trend),
      completed: Math.floor(baseBounties * noise * trend * 0.8),
      newContributors: Math.floor(baseContributors * noise * trend)
    });
  }
  return data;
};

export const AnalyticsCharts: React.FC<AnalyticsChartsProps & { data: any[] }> = ({ timeRange, data }) => {

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-forge-900 border border-forge-800 p-4 rounded-lg shadow-xl">
          <p className="text-text-primary font-medium mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: <span className="font-mono font-bold">{entry.value.toLocaleString()}</span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Volume Chart */}
      <motion.div variants={fadeIn} className="bg-forge-900 border border-forge-800 rounded-xl p-6 lg:col-span-2">
        <div className="mb-6">
          <h3 className="text-lg font-bold text-text-primary">Bounty Volume & Payouts</h3>
          <p className="text-sm text-text-muted">Total value of bounties posted and paid over time ($FNDRY)</p>
        </div>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
              <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val / 1000}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" name="Payout Volume" dataKey="volume" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorVolume)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Completion Rates Chart */}
      <motion.div variants={fadeIn} className="bg-forge-900 border border-forge-800 rounded-xl p-6">
        <div className="mb-6">
          <h3 className="text-lg font-bold text-text-primary">Bounty Completion Trend</h3>
          <p className="text-sm text-text-muted">Posted vs Successfully Completed</p>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
              <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
              <Bar name="Posted" dataKey="bounties" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
              <Line name="Completed" type="monotone" dataKey="completed" stroke="#10b981" strokeWidth={2} dot={{ r: 4, fill: '#10b981', strokeWidth: 0 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Contributor Growth */}
      <motion.div variants={fadeIn} className="bg-forge-900 border border-forge-800 rounded-xl p-6">
        <div className="mb-6">
          <h3 className="text-lg font-bold text-text-primary">Contributor Growth</h3>
          <p className="text-sm text-text-muted">New developers joining and resolving bounties</p>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
              <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar name="New Contributors" dataKey="newContributors" fill="#d946ef" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
    </div>
  );
};
