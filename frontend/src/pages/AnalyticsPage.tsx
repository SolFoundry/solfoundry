import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Download, TrendingUp, Users, Activity, CheckCircle, BarChart2 } from 'lucide-react';
import { PageLayout } from '../components/layout/PageLayout';
import { pageTransition, fadeIn } from '../lib/animations';
import { AnalyticsCharts, generateTimeSeriesData } from '../components/analytics/AnalyticsCharts';

const mockSummary = {
  totalVolume: 1250000,
  totalBounties: 342,
  completedBounties: 289,
  activeContributors: 154,
  completionRate: 84.5
};

export function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState('30d');
  const [isExporting, setIsExporting] = useState(false);

  const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365;
  // Compute chart data exactly once for the parent, and pass down to both UI and CSV exporter
  const analyticsData = React.useMemo(() => generateTimeSeriesData(days), [days]);

  const exportCSV = () => {
    const data = analyticsData;
    let csvContent = "data:text/csv;charset=utf-8,Date,Volume ($FNDRY),Posted Bounties,Completed Bounties,New Contributors\n";
    
    data.forEach(row => {
      csvContent += `${row.date},${row.volume},${row.bounties},${row.completed},${row.newContributors}\n`;
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `solfoundry_analytics_${timeRange}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const exportPDF = async () => {
    try {
      setIsExporting(true);
      const { jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;
      
      const element = document.getElementById('analytics-dashboard');
      if (!element) return;
      
      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: '#0A0A0A'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [canvas.width / 2, canvas.height / 2]
      });
      
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2);
      pdf.save(`solfoundry_analytics_report_${timeRange}.pdf`);
    } catch (error) {
      console.error("Failed to generate PDF:", error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <PageLayout>
      <motion.div
        id="analytics-dashboard"
        variants={pageTransition}
        initial="initial"
        animate="animate"
        exit="exit"
        className="pt-24 pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <h1 className="text-3xl font-bold text-text-primary mb-2 flex items-center gap-3">
              <BarChart2 className="w-8 h-8 text-emerald" />
              Bounty Analytics
            </h1>
            <p className="text-text-muted">Track ecosystem growth, contributor engagement, and payout trends.</p>
          </div>
          
          <div className="flex items-center gap-4">
            <select 
              className="bg-forge-900 border border-forge-800 text-text-primary text-sm rounded-lg focus:ring-emerald focus:border-emerald block p-2.5"
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
            >
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="all">All Time</option>
            </select>
            
            <div className="flex gap-2">
              <button 
                onClick={exportCSV}
                className="flex items-center gap-2 px-4 py-2 bg-forge-900 hover:bg-forge-800 border border-forge-800 text-text-primary rounded-lg transition-colors text-sm font-medium"
              >
                <Download className="w-4 h-4" /> CSV
              </button>
              <button 
                onClick={exportPDF}
                disabled={isExporting}
                className="flex items-center gap-2 px-4 py-2 bg-emerald/10 hover:bg-emerald/20 border border-emerald/20 text-emerald rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
              >
                {isExporting ? <span className="w-4 h-4 border-2 border-emerald border-t-transparent rounded-full animate-spin" /> : <Download className="w-4 h-4" />} PDF Report
              </button>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <motion.div variants={fadeIn} className="bg-forge-900 border border-forge-800 rounded-xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald/5 rounded-bl-full -mr-10 -mt-10" />
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 rounded-lg bg-emerald/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-emerald" />
              </div>
              <h3 className="text-text-muted font-medium">Total Volume</h3>
            </div>
            <div className="text-2xl font-bold text-text-primary font-mono mb-1">
              {mockSummary.totalVolume.toLocaleString()} <span className="text-sm text-text-muted">$FNDRY</span>
            </div>
            <div className="text-sm text-emerald flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> +12.5% vs previous
            </div>
          </motion.div>

          <motion.div variants={fadeIn} className="bg-forge-900 border border-forge-800 rounded-xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-bl-full -mr-10 -mt-10" />
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Activity className="w-5 h-5 text-blue-500" />
              </div>
              <h3 className="text-text-muted font-medium">Active Bounties</h3>
            </div>
            <div className="text-2xl font-bold text-text-primary font-mono mb-1">
              {mockSummary.totalBounties}
            </div>
            <div className="text-sm text-blue-500 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> +4.2% vs previous
            </div>
          </motion.div>

          <motion.div variants={fadeIn} className="bg-forge-900 border border-forge-800 rounded-xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-magenta/5 rounded-bl-full -mr-10 -mt-10" />
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 rounded-lg bg-magenta/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-magenta" />
              </div>
              <h3 className="text-text-muted font-medium">Contributors</h3>
            </div>
            <div className="text-2xl font-bold text-text-primary font-mono mb-1">
              {mockSummary.activeContributors}
            </div>
            <div className="text-sm text-magenta flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> +28.4% vs previous
            </div>
          </motion.div>

          <motion.div variants={fadeIn} className="bg-forge-900 border border-forge-800 rounded-xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-bl-full -mr-10 -mt-10" />
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-amber-500" />
              </div>
              <h3 className="text-text-muted font-medium">Completion Rate</h3>
            </div>
            <div className="text-2xl font-bold text-text-primary font-mono mb-1">
              {mockSummary.completionRate}%
            </div>
            <div className="text-sm text-amber-500 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> +2.1% vs previous
            </div>
          </motion.div>
        </div>

        {/* Charts Section */}
        <AnalyticsCharts timeRange={timeRange} data={analyticsData} />

      </motion.div>
    </PageLayout>
  );
}
