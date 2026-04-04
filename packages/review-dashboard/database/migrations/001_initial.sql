CREATE TABLE reviews (
  id TEXT PRIMARY KEY,
  submission_title TEXT NOT NULL,
  submitter TEXT NOT NULL,
  category TEXT NOT NULL,
  submitted_at TEXT NOT NULL
);

CREATE TABLE model_reviews (
  id TEXT PRIMARY KEY,
  review_id TEXT NOT NULL REFERENCES reviews(id),
  model TEXT NOT NULL,
  score REAL NOT NULL,
  confidence REAL NOT NULL,
  recommendation TEXT NOT NULL,
  reasoning TEXT NOT NULL
);

CREATE TABLE appeals (
  id TEXT PRIMARY KEY,
  review_id TEXT NOT NULL REFERENCES reviews(id),
  appellant TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL,
  priority TEXT NOT NULL,
  requested_at TEXT NOT NULL,
  assigned_reviewer_id TEXT
);

CREATE TABLE appeal_events (
  id TEXT PRIMARY KEY,
  appeal_id TEXT NOT NULL REFERENCES appeals(id),
  timestamp TEXT NOT NULL,
  actor TEXT NOT NULL,
  type TEXT NOT NULL,
  note TEXT NOT NULL
);
