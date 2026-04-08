import { Bounty } from "../frontend/src/services/BountyService";

// **Acceptance Criteria 2: TypeScript type definitions with JSDoc**
describe("TypeScript Type Definitions", () => {
  it("should define types for bounties", () => {
    // Arrange
    const exampleBounty: Bounty = {
      id: "bounty01",
      title: "First Bounty",
      description: "Complete this task to earn a reward",
      value: 100,
      createdDate: new Date(),
    };
    // Assert
    expect(exampleBounty).toHaveProperty("id");
    expect(exampleBounty).toHaveProperty("title");
    expect(exampleBounty).toHaveProperty("value");
  });
});
