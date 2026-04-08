"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const submissions_1 = require("../../backend/api/submissions");
let submissions = []; // Define submissions variable
describe("Submission API Tests", () => {
  beforeEach(() => {
    // Clear the submissions list before each test
    submissions = []; // Reset submissions to an empty array before each test.
  });
  test("Submit a bounty", () => {
    const newSubmission = (0, submissions_1.createSubmission)({
      id: "1",
      bountyId: "1",
      userId: "user1",
      submissionDate: new Date(),
      status: "pending",
    });
    expect(newSubmission).toHaveProperty("id", "1");
  });
  test("Fetch submissions for a bounty", () => {
    (0, submissions_1.createSubmission)({
      id: "1",
      bountyId: "1",
      userId: "user1",
      submissionDate: new Date(),
      status: "pending",
    });
    const submissions = (0, submissions_1.fetchSubmissions)("1");
    expect(submissions.length).toBe(1);
  });
});
