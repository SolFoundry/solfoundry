// BountyService.ts

import {
  createBounty,
  fetchBounties,
  updateBounty,
  deleteBounty,
} from "../../solfoundry/backend/api/bounties";

// Interface for Bounty (to maintain consistent type structure)
export interface Bounty {
  id: string;
  title: string;
  description: string;
  value: number;
  createdDate: Date;
}

// Function to create a bounty (wrapper for API)
export const createNewBounty = async (bounty: Bounty) => {
  return createBounty(bounty); // Call to the API function
};

// Function to fetch all bounties (wrapper for API)
export const getAllBounties = async () => {
  return fetchBounties(); // Call to the API function
};

// Function to update a bounty (wrapper for API)
export const modifyBounty = async (id: string, updatedBounty: Bounty) => {
  return updateBounty(id, updatedBounty);
};

// Function to delete a bounty (wrapper for API)
export const removeBounty = async (id: string) => {
  deleteBounty(id); // Call to the API function
};
