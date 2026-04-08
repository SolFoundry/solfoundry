import React from "react";
import { render, fireEvent, screen } from "@testing-library/react";
// Commenting out CSS-related imports for testing.
// import '../styles.css';
import { describe, test, expect } from "vitest";
import BountyFlowDiagram from "./BountyFlowDiagram.jsx";

// Integration test for tooltip functionality
describe("BountyFlowDiagram Tooltips", () => {
  test("displays tooltip on hover for all states", () => {
    render(React.createElement(BountyFlowDiagram));
    const states = ["Post", "Claim", "Work", "Submit", "Review", "Payment"];
    states.forEach((state) => {
      const stateElement = screen.getByText(state);
      fireEvent.mouseOver(stateElement);
      expect(screen.getByText("Tooltip for " + state)).toBeVisible();
    });
  });
});
