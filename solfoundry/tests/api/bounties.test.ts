import {
  createBounty,
  fetchBounties,
  updateBounty,
  deleteBounty,
} from "../../backend/api/bounties";

describe("Bounty API Tests", () => {
  interface Bounty {
    id: string;
    title: string;
    description: string;
    value: number;
    createdDate: Date;
  }
  let bounties: Bounty[] = []; // Initialize bounties array

  beforeEach(() => {
    // Clear the bounty list before each test
    bounties = []; // Reset bounties to an empty array before each test.
  });

  test("Create a bounty", () => {
    const newBounty = createBounty({
      id: "1",
      title: "Bounty One",
      description: "A test bounty",
      value: 100,
      createdDate: new Date(),
    });
    expect(newBounty).toHaveProperty("id", "1");
  });

  test("Fetch bounties", () => {
    createBounty({
      id: "1",
      title: "Bounty One",
      description: "A test bounty",
      value: 100,
      createdDate: new Date(),
    });
    const bounties = fetchBounties();
    expect(bounties.length).toBe(1);
  });

  test("Update a bounty", () => {
    createBounty({
      id: "1",
      title: "Bounty One",
      description: "A test bounty",
      value: 100,
      createdDate: new Date(),
    });
    const updatedBounty = updateBounty("1", {
      id: "1",
      title: "Updated Bounty One",
      description: "A test bounty",
      value: 100,
      createdDate: new Date(),
    });
    expect(updatedBounty).toHaveProperty("title", "Updated Bounty One");
  });

  test("Delete a bounty", () => {
    createBounty({
      id: "1",
      title: "Bounty One",
      description: "A test bounty",
      value: 100,
      createdDate: new Date(),
    });
    deleteBounty("1");
    const bounties = fetchBounties();
    expect(bounties.length).toBe(0);
  });
});
