import React, { useEffect, useState } from 'react';

interface Service {
  name: string;
  status: 'operational' | 'degraded' | 'down';
  latency?: number;
  uptime: {
    '24h': number;
    '7d': number;
    '30d': number;
  };
}

interface Incident {
  id: string;
  date: string;
  description: string;
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
}

interface HealthData {
  status: 'ok' | 'degraded' | 'down';
  services: Service[];
  incidents: Incident[];
  last_sync?: string;
  dependencies?: Record<string, string>;
}

export function HealthPage() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchStatus = async () => {
    try {
      // Use relative API path suitable for production proxying
      const response = await fetch('/api/health');
      if (!response.ok) {
        throw new Error('Failed to fetch status');
      }
      const json = await response.json();
      
      // Compute overall status dynamically from service statuses if missing
      if (!json.status && json.services) {
          const hasDown = json.services.some((s: Service) => s.status === 'down');
          const hasDegraded = json.services.some((s: Service) => s.status === 'degraded');
          json.status = hasDown ? 'down' : (hasDegraded ? 'degraded' : 'ok');
      }
      
      setData(json);
      setLastUpdated(new Date());
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Unable to connect to health API');
      // If complete failure, build synthetic down state
      setData({
        status: 'down',
        services: [],
        incidents: []
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Refresh every 30 seconds
    const intervalId = setInterval(fetchStatus, 30000);
    return () => clearInterval(intervalId);
  }, []);

  if (loading && !data) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#9945FF]"></div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'operational':
      case 'ok':
        return 'bg-green-500';
      case 'degraded':
        return 'bg-yellow-500';
      case 'down':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'operational': case 'ok': return 'All Systems Operational';
      case 'degraded': return 'Partial System Outage';
      case 'down': return 'Major System Outage';
      default: return 'Unknown Status';
    }
  };

  const overallStatus = data?.status || 'unknown';

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8 text-black dark:text-white">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-6 border-gray-200 dark:border-gray-800">
        <div>
          <h1 className="text-3xl font-bold">Platform Status</h1>
          <p className="text-gray-500 mt-2">Real-time health of SolFoundry services.</p>
        </div>
        <div className="flex space-x-2 mt-4 md:mt-0 text-sm">
           <span className="text-gray-500">Last updated: {lastUpdated.toLocaleTimeString()}</span>
           <button onClick={fetchStatus} className="text-[#9945FF] hover:underline cursor-pointer">Refresh</button>
        </div>
      </header>

      {error && (
         <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
           <span className="block sm:inline">{error}</span>
         </div>
      )}

      {/* OVERALL BANNER */}
      <div className={`p-6 rounded-lg text-white flex items-center shadow-lg ${
        overallStatus === 'ok' ? 'bg-gradient-to-r from-green-500 to-green-600' :
        overallStatus === 'degraded' ? 'bg-gradient-to-r from-yellow-500 to-yellow-600' :
        'bg-gradient-to-r from-red-500 to-red-600'
      }`}>
        <div className="w-4 h-4 bg-white rounded-full mr-4 animate-pulse"></div>
        <div className="text-xl font-semibold">
          {getStatusText(overallStatus)}
        </div>
      </div>

      {/* SERVICE LIST */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Service Connectivity</h2>
        <div className="bg-white dark:bg-gray-900 shadow rounded-lg border border-gray-100 dark:border-gray-800 overflow-hidden text-black dark:text-white">
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {data?.services && data.services.length > 0 ? data.services.map((service, idx) => (
              <li key={idx} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${getStatusColor(service.status)}`}></div>
                  <span className="font-medium text-lg">{service.name}</span>
                </div>
                <div className="flex space-x-4 text-sm text-gray-500">
                  {service.latency !== undefined && (
                    <span className="hidden sm:block">Latency: {service.latency}ms</span>
                  )}
                  {service.uptime && (
                    <span className="hidden sm:block">Uptime 24h: {service.uptime['24h']}%</span>
                  )}
                  <span className="capitalize font-medium block" 
                        style={{color: service.status === 'operational' ? '#22c55e' : service.status === 'degraded' ? '#eab308' : '#ef4444'}}>
                    {service.status}
                  </span>
                </div>
              </li>
            )) : (
              <li className="p-4 text-gray-500 italic">No service data available.</li>
            )}
          </ul>
        </div>
      </div>

      {/* INCIDENT HISTORY */}
      <div>
        <h2 className="text-2xl font-semibold mb-4 text-black dark:text-white">Incident History</h2>
        {data?.incidents && data.incidents.length > 0 ? (
          <div className="space-y-4">
            {data.incidents.map((inc) => (
              <div key={inc.id} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-5 rounded-lg shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-medium text-lg text-black dark:text-white">{inc.date}</h3>
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full capitalize ${
                    inc.status === 'resolved' ? 'bg-green-100 text-green-800' :
                    inc.status === 'monitoring' ? 'bg-blue-100 text-blue-800' :
                    inc.status === 'identified' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {inc.status}
                  </span>
                </div>
                <p className="text-gray-600 dark:text-gray-400">{inc.description}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-8 text-center text-gray-500">
            No incidents reported recently.
          </div>
        )}
      </div>
    </div>
  );
}
