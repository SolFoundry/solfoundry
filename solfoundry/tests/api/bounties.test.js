"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bounties_1 = require("../../backend/api/bounties");
describe("Bounty API Tests", () => {
  let bounties = []; // Initialize bounties array
  beforeEach(() => {
    // Clear the bounty list before each test
    bounties = []; // Reset bounties to an empty array before each test.
  });
  test("Create a bounty", () => {
    const newBounty = (0, bounties_1.createBounty)({
      id: "1",
      title: "Bounty One",
      description: "A test bounty",
      value: 100,
      createdDate: new Date(),
    });
    expect(newBounty).toHaveProperty("id", "1");
  });
  test("Fetch bounties", () => {
    (0, bounties_1.createBounty)({
      id: "1",
      title: "Bounty One",
      description: "A test bounty",
      value: 100,
      createdDate: new Date(),
    });
    const bounties = (0, bounties_1.fetchBounties)();
    expect(bounties.length).toBe(1);
  });
  test("Update a bounty", () => {
    (0, bounties_1.createBounty)({
      id: "1",
      title: "Bounty One",
      description: "A test bounty",
      value: 100,
      createdDate: new Date(),
    });
    const updatedBounty = (0, bounties_1.updateBounty)("1", {
      id: "1",
      title: "Updated Bounty One",
      description: "A test bounty",
      value: 100,
      createdDate: new Date(),
    });
    expect(updatedBounty).toHaveProperty("title", "Updated Bounty One");
  });
  test("Delete a bounty", () => {
    (0, bounties_1.createBounty)({
      id: "1",
      title: "Bounty One",
      description: "A test bounty",
      value: 100,
      createdDate: new Date(),
    });
    (0, bounties_1.deleteBounty)("1");
    const bounties = (0, bounties_1.fetchBounties)();
    expect(bounties.length).toBe(0);
  });
});
