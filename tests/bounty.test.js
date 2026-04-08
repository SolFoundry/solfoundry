"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const BountyService_1 = require("../frontend/src/services/BountyService");
// **Acceptance Criteria 1: Full API coverage for bounties, submissions, and users**
describe("Bounty API", () => {
  it("should respond with bounty details", async () => {
    // Arrange
    const bountyId = "example-bounty-id";
    // Act
    const response = await (0, BountyService_1.getAllBounties)();
    // Assert
    expect(response).toBeDefined();
  });
  it("should handle bounty not found", async () => {
    // Arrange
    // Act
    await expect((0, BountyService_1.getAllBounties)()).rejects.toThrow(
      "Bounty not found",
    );
  });
});
