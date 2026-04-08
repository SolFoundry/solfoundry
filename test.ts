import { createBounty } from "../../solfoundry/backend/api/bounties";

const testBounty = {
  id: "test1",
  title: "Test Bounty",
  description: "This is a test bounty.",
  value: 50,
  createdDate: new Date(),
};

console.log(createBounty(testBounty)); // Log the result of calling createBounty with testBounty.
