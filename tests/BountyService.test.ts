// BountyService.test.ts

import {
  createNewBounty,
  getAllBounties,
  modifyBounty,
  removeBounty,
  Bounty,
} from "../frontend/src/services/BountyService";

describe("BountyService", () => {
  let testBounty: Bounty;

  beforeEach(() => {
    // Setup a test bounty
    testBounty = {
      id: "1",
      title: "Test Bounty",
      description: "Testing the bounty creation",
      value: 100,
      createdDate: new Date(),
    };
  });

  test("should create a new bounty", async () => {
    const result = await createNewBounty(testBounty);
    expect(result).toEqual(testBounty);
  });

  test("should fetch all bounties", async () => {
    await createNewBounty(testBounty);
    const bounties = await getAllBounties();
    expect(bounties.length).toBe(1);
    expect(bounties[0]).toEqual(testBounty);
  });

  test("should update an existing bounty", async () => {
    await createNewBounty(testBounty);
    const updatedBounty = { ...testBounty, value: 150 };
    const result = await modifyBounty(testBounty.id, updatedBounty);
    expect(result).toEqual(updatedBounty);
  });

  test("should delete a bounty", async () => {
    await createNewBounty(testBounty);
    await removeBounty(testBounty.id);
    const bounties = await getAllBounties();
    expect(bounties.length).toBe(0);
  });
});
