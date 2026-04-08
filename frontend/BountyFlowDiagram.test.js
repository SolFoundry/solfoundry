import React from "react";
import { render, fireEvent, screen } from "@testing-library/react";
// Commenting out CSS-related imports for testing.
// import '../styles.css';
import { describe, test, expect } from "vitest";
import BountyFlowDiagram from "./BountyFlowDiagram.jsx";

// Unit test for state transitions
describe("<BountyFlowDiagram /> Unit Tests", () => {
  test("renders all states in the lifecycle", () => {
    render(React.createElement(BountyFlowDiagram));
    const states = ["Post", "Claim", "Work", "Submit", "Review", "Payment"];
    states.forEach((state) => {
      expect(screen.getByText(state)).toBeInTheDocument();
    });
  });
});
