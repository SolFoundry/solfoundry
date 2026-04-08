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

export const createNewBounty = async (bounty: Bounty) => {
  return createBounty(bounty);
};

export const getAllBounties = async () => {
  return fetchBounties();
};

export const modifyBounty = async (id: string, updatedBounty: Bounty) => {
  return updateBounty(id, updatedBounty);
};

export const removeBounty = async (id: string) => {
  deleteBounty(id);
};
