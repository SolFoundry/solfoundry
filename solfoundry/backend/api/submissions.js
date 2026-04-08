"use strict";
// submissions.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSubmission = createSubmission;
exports.fetchSubmissions = fetchSubmissions;
let submissions = [];
/**
 * Submit a bounty.
 * @param {Submission} submission - The submission data.
 * @returns {Submission} The created submission.
 */
function createSubmission(submission) {
  // Implementation code here
  submissions.push(submission);
  return submission;
}
/**
 * Fetch all submissions for a bounty.
 * @param {string} bountyId - The id of the bounty to fetch submissions for.
 * @returns {Submission[]} List of all submissions for the bounty.
 */
function fetchSubmissions(bountyId) {
  return submissions.filter((s) => s.bountyId === bountyId);
}
