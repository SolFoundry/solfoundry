import { createNewBounty } from "../frontend/src/services/BountyService";

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
    const response = await createNewBounty(bountyPayload);
    // Assert
    expect(response).toHaveProperty("id");
    expect(response.title).toBe(bountyPayload.title);
  });
});
