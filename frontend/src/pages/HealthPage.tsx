import React, { useState, useEffect } from "react";

interface ServiceStatus {
    name: string;
    status: "operational" | "degraded" | "down";
    latency: number;
}

export function HealthPage() {
    const [services, setServices] = useState<ServiceStatus[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStatus = async () => {
            setLoading(true);
            setTimeout(() => {
                setServices([
                    { name: "API Gateway", status: "operational", latency: 45 },
                    { name: "PostgreSQL Database", status: "operational", latency: 12 },
                    { name: "Redis Cache", status: "operational", latency: 3 },
                    { name: "Solana RPC", status: "degraded", latency: 1500 }
                ]);
                setLoading(false);
            }, 500);
        };
        fetchStatus();
    }, []);

    if (loading) return <div data-testid="loading-state">Loading system status...</div>;

    const isAllOperational = services.every(s => s.status === "operational");

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">System Health Indicator</h1>
            <div className={`p-4 rounded-lg mb-8 ${isAllOperational ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                <p className="font-semibold text-lg">{isAllOperational ? "All Systems Operational" : "Partial System Outage or Degradation"}</p>
            </div>
            <div className="grid gap-4">
                {services.map(service => (
                    <div key={service.name} data-testid={`service-${service.name.replace(/\s+/g, '-')}`} className="flex justify-between items-center p-4 border rounded shadow-sm">
                        <div className="font-medium text-gray-700">{service.name}</div>
                        <div className="flex items-center gap-4">
                            <span className="text-sm text-gray-500">{service.latency}ms</span>
                            <span className={`px-3 py-1 rounded-full text-sm font-bold ${service.status === 'operational' ? 'bg-green-100 text-green-700' : service.status === 'degraded' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                {service.status.toUpperCase()}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
