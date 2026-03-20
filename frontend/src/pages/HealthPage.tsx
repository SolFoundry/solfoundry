import React, { useState, useEffect } from "react";

interface ServiceStatus {
    name: string;
    status: "operational" | "degraded" | "down";
    latency: number;
    uptime: {
        "24h": number;
        "7d": number;
        "30d": number;
    };
}

interface Incident {
    id: string;
    date: string;
    description: string;
    status: "resolved" | "investigating";
}

interface HealthData {
    services: ServiceStatus[];
    incidents: Incident[];
}

export function HealthPage() {
    const [data, setData] = useState<HealthData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchStatus = async () => {
        try {
            const response = await fetch("http://localhost:8000/api/health"); // In real setup this uses env var, mocking here since local fetch works fine
            if (!response.ok) throw new Error("Failed to fetch");
            const result = await response.json();
            setData(result);
            setError(null);
        } catch (err) {
            // Also try relative
            try {
                const response2 = await fetch("/api/health");
                if (!response2.ok) throw new Error("Failed again");
                const result2 = await response2.json();
                setData(result2);
                setError(null);
            } catch (err2) {
                setError("Failed to load service status.");
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();
        const intervalId = setInterval(fetchStatus, 30000);
        return () => clearInterval(intervalId);
    }, []);

    if (loading && !data) {
        return <div data-testid="loading-state">Loading system status...</div>;
    }
    
    if (error && !data) {
        return <div data-testid="error-state" className="text-red-500">{error}</div>;
    }

    const services = data?.services || [];
    const incidents = data?.incidents || [];
    const isAllOperational = services.every(s => s.status === "operational");

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">System Health Indicator</h1>
            
            <div className={`p-4 rounded-lg mb-8 ${isAllOperational ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                <p className="font-semibold text-lg" data-testid="overall-status">
                    {isAllOperational ? "All Systems Operational" : "Partial System Outage or Degradation"}
                </p>
            </div>

            <div className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">Core Services</h2>
                <div className="grid gap-4">
                    {services.map(service => (
                        <div key={service.name} data-testid={`service-${service.name.replace(/\s+/g, '-')}`} className="flex flex-col sm:flex-row justify-between p-4 border rounded shadow-sm">
                            <div className="font-medium text-gray-700 w-1/3">{service.name}</div>
                            <div className="flex gap-4 w-1/3 text-sm text-gray-600 justify-center">
                                <span>24h: {service.uptime["24h"]}%</span>
                                <span>7d: {service.uptime["7d"]}%</span>
                                <span>30d: {service.uptime["30d"]}%</span>
                            </div>
                            <div className="flex items-center gap-4 w-1/3 justify-end">
                                <span className="text-sm text-gray-500">{service.latency}ms</span>
                                <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                                    service.status === 'operational' ? 'bg-green-100 text-green-700' : 
                                    service.status === 'degraded' ? 'bg-yellow-100 text-yellow-700' : 
                                    'bg-red-100 text-red-700'
                                }`}>
                                    {service.status.toUpperCase()}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">Incident History</h2>
                {incidents.length === 0 ? (
                    <p className="text-gray-500" data-testid="no-incidents">No recent incidents.</p>
                ) : (
                    <div className="grid gap-4" data-testid="incident-history">
                        {incidents.map(incident => (
                            <div key={incident.id} className="p-4 border-l-4 border-blue-500 bg-gray-50 rounded">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="font-semibold text-gray-800">{incident.date}</span>
                                    <span className={`text-xs px-2 py-1 rounded ${
                                        incident.status === 'resolved' ? 'bg-gray-200 text-gray-700' : 'bg-red-200 text-red-800'
                                    }`}>
                                        {incident.status.toUpperCase()}
                                    </span>
                                </div>
                                <p className="text-gray-700">{incident.description}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
