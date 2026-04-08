"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const BountyService_1 = require("../frontend/src/services/BountyService");
describe("BountyService", () => {
  let testBounty;
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
    const result = await (0, BountyService_1.createNewBounty)(testBounty);
    expect(result).toEqual(testBounty);
  });
  test("should fetch all bounties", async () => {
    await (0, BountyService_1.createNewBounty)(testBounty);
    const bounties = await (0, BountyService_1.getAllBounties)();
    expect(bounties.length).toBe(1);
    expect(bounties[0]).toEqual(testBounty);
  });
  test("should update an existing bounty", async () => {
    await (0, BountyService_1.createNewBounty)(testBounty);
    const updatedBounty = { ...testBounty, value: 150 };
    const result = await (0, BountyService_1.modifyBounty)(
      testBounty.id,
      updatedBounty,
    );
    expect(result).toEqual(updatedBounty);
  });
  test("should delete a bounty", async () => {
    await (0, BountyService_1.createNewBounty)(testBounty);
    await (0, BountyService_1.removeBounty)(testBounty.id);
    const bounties = await (0, BountyService_1.getAllBounties)();
    expect(bounties.length).toBe(0);
  });
});
