"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeBounty =
  exports.modifyBounty =
  exports.getAllBounties =
  exports.createNewBounty =
    void 0;
const bounties_1 = require("../../solfoundry/backend/api/bounties");
const createNewBounty = async (bounty) => {
  return (0, bounties_1.createBounty)(bounty);
};
exports.createNewBounty = createNewBounty;
const getAllBounties = async () => {
  return (0, bounties_1.fetchBounties)();
};
exports.getAllBounties = getAllBounties;
const modifyBounty = async (id, updatedBounty) => {
  return (0, bounties_1.updateBounty)(id, updatedBounty);
};
exports.modifyBounty = modifyBounty;
const removeBounty = async (id) => {
  (0, bounties_1.deleteBounty)(id);
};
exports.removeBounty = removeBounty;
