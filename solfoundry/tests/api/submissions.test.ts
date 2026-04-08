import {
  createSubmission,
  fetchSubmissions,
} from "../../backend/api/submissions";

interface Submission {
  id: string;
  bountyId: string;
  userId: string;
  submissionDate: Date;
  status: string;
}

let submissions: Submission[] = []; // Define submissions variable

describe("Submission API Tests", () => {
  beforeEach(() => {
    // Clear the submissions list before each test
    submissions = []; // Reset submissions to an empty array before each test.
  });

  test("Submit a bounty", () => {
    const newSubmission = createSubmission({
      id: "1",
      bountyId: "1",
      userId: "user1",
      submissionDate: new Date(),
      status: "pending",
    });
    expect(newSubmission).toHaveProperty("id", "1");
  });

  test("Fetch submissions for a bounty", () => {
    createSubmission({
      id: "1",
      bountyId: "1",
      userId: "user1",
      submissionDate: new Date(),
      status: "pending",
    });
    const submissions = fetchSubmissions("1");
    expect(submissions.length).toBe(1);
  });
});
