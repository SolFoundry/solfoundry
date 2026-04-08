"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bounties_1 = require("../../solfoundry/backend/api/bounties");
var testBounty = {
  id: "test1",
  title: "Test Bounty",
  description: "This is a test bounty.",
  value: 50,
  createdDate: new Date(),
};
console.log((0, bounties_1.createBounty)(testBounty)); // Log the result of calling createBounty with testBounty.
