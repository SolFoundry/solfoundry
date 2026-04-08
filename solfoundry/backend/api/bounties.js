"use strict";
// bounties.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBounty = createBounty;
exports.fetchBounties = fetchBounties;
exports.updateBounty = updateBounty;
exports.deleteBounty = deleteBounty;
let bounties = [];
/**
 * Create a new bounty.
 * @param {Bounty} bounty - The bounty to create.
 * @returns {Bounty} The created bounty.
 */
function createBounty(bounty) {
  // Implementation code here
  bounties.push(bounty);
  return bounty;
}
/**
 * Fetch all bounties.
 * @returns {Bounty[]} List of all bounties.
 */
function fetchBounties() {
  return bounties;
}
/**
 * Update a bounty.
 * @param {string} id - The id of the bounty to update.
 * @param {Bounty} updatedBounty - The new bounty data.
 * @returns {Bounty | null} The updated bounty or null if not found.
 */
function updateBounty(id, updatedBounty) {
  // Implementation code here
  const index = bounties.findIndex((b) => b.id === id);
  if (index !== -1) {
    bounties[index] = { ...bounties[index], ...updatedBounty };
    return bounties[index];
  }
  return null;
}
/**
 * Delete a bounty.
 * @param {string} id - The id of the bounty to delete.
 */
function deleteBounty(id) {
  bounties = bounties.filter((b) => b.id !== id);
}
