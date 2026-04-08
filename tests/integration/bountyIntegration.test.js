"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const BountyService_1 = require("../frontend/src/services/BountyService");
// **Integration tests for bounty management**
describe("Bounty Integration Tests", () => {
  it("should create a bounty successfully", async () => {
    // Arrange
    const bountyPayload = {
      title: "New Bounty",
      description: "This bounty needs to be fulfilled.",
      value: 200,
      createdDate: new Date(),
    };
    // Act
    const response = await (0, BountyService_1.createNewBounty)(bountyPayload);
    // Assert
    expect(response).toHaveProperty("id");
    expect(response.title).toBe(bountyPayload.title);
  });
});
