PRAGMA foreign_keys = ON;
CREATE TABLE authors (
  code TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK(role IN ('author','admin')),
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX one_admin ON authors(role) WHERE role = 'admin';
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  author_code TEXT NOT NULL REFERENCES authors(code),
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE submissions (
  id TEXT PRIMARY KEY,
  author_code TEXT NOT NULL REFERENCES authors(code),
  kind TEXT NOT NULL,
  share_code TEXT UNIQUE,
  published_revision TEXT,
  pending_revision TEXT,
  latest_revision TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE INDEX submissions_author ON submissions(author_code, updated_at);
CREATE TABLE revisions (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES submissions(id),
  metadata TEXT NOT NULL,
  blob_key TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending','approved','rejected','withdrawn')),
  review_note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  reviewed_at INTEGER
);
CREATE INDEX revisions_submission ON revisions(submission_id);
CREATE TABLE limits (
  key TEXT PRIMARY KEY,
  value INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
