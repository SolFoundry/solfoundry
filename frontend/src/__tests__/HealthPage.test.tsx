import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { HealthPage } from "../pages/HealthPage";

describe("HealthPage", () => {
    it("renders loading state initially", () => {
        render(<HealthPage />);
        expect(screen.getByTestId("loading-state")).toBeInTheDocument();
    });

    it("renders service statuses", async () => {
        render(<HealthPage />);
        await waitFor(() => {
            expect(screen.queryByTestId("loading-state")).not.toBeInTheDocument();
        });
        expect(screen.getByText("System Health Indicator")).toBeInTheDocument();
        expect(screen.getByTestId("service-API-Gateway")).toBeInTheDocument();
        expect(screen.getByText("45ms")).toBeInTheDocument();
    });
});
