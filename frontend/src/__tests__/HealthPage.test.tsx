import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import { HealthPage } from "../pages/HealthPage";

const mockData = {
    services: [
        { name: "API", status: "operational", latency: 45, uptime: { "24h": 99.9, "7d": 99.8, "30d": 99.9 } },
        { name: "WebSocket", status: "operational", latency: 12, uptime: { "24h": 100, "7d": 99.9, "30d": 99.5 } },
        { name: "GitHub webhook receiver", status: "operational", latency: 5, uptime: { "24h": 100, "7d": 100, "30d": 100 } },
        { name: "Solana RPC", status: "degraded", latency: 1500, uptime: { "24h": 95.0, "7d": 98.0, "30d": 99.0 } },
        { name: "review pipeline", status: "operational", latency: 200, uptime: { "24h": 100, "7d": 100, "30d": 99.9 } }
    ],
    incidents: [
        { id: "1", date: "2026-03-20", description: "Solana RPC node syncing delay.", status: "resolved" }
    ]
};

describe("HealthPage", () => {
    beforeEach(() => {
        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockData)
            })
        ) as jest.Mock;
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
        jest.clearAllMocks();
    });

    it("renders loading state initially", async () => {
        render(<HealthPage />);
        expect(screen.getByTestId("loading-state")).toBeInTheDocument();
        await act(async () => {
            await Promise.resolve();
        });
    });

    it("renders service statuses and uptime after data fetch", async () => {
        render(<HealthPage />);
        
        await waitFor(() => {
            expect(screen.queryByTestId("loading-state")).not.toBeInTheDocument();
        });
        
        expect(screen.getByText("System Health Indicator")).toBeInTheDocument();
        expect(screen.getByTestId("overall-status")).toHaveTextContent("Partial System Outage or Degradation");
        
        expect(screen.getByTestId("service-API")).toBeInTheDocument();
        expect(screen.getByTestId("service-Solana-RPC")).toBeInTheDocument();
        expect(screen.getByTestId("service-WebSocket")).toBeInTheDocument();
        expect(screen.getByTestId("service-GitHub-webhook-receiver")).toBeInTheDocument();
        expect(screen.getByTestId("service-review-pipeline")).toBeInTheDocument();
        
        expect(screen.getAllByText(/24h: 99.9%/).length).toBeGreaterThan(0);

        expect(screen.getByTestId("incident-history")).toBeInTheDocument();
        expect(screen.getByText("Solana RPC node syncing delay.")).toBeInTheDocument();
    });

    it("polls for new data every 30 seconds", async () => {
        render(<HealthPage />);
        
        await waitFor(() => {
            expect(screen.queryByTestId("loading-state")).not.toBeInTheDocument();
        });

        expect(global.fetch).toHaveBeenCalledTimes(1);

        await act(async () => {
            jest.advanceTimersByTime(30000);
        });

        expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it("renders error state when fetch fails", async () => {
        (global.fetch as jest.Mock).mockImplementation(() =>
            Promise.reject(new Error("Network Error"))
        );

        render(<HealthPage />);
        
        await waitFor(() => {
            expect(screen.getByTestId("error-state")).toBeInTheDocument();
        });
        
        expect(screen.getByText("Failed to load service status.")).toBeInTheDocument();
    });
});
