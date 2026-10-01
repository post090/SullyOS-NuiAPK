CREATE TABLE beauty_repos (
  id TEXT PRIMARY KEY,
  request_key TEXT NOT NULL UNIQUE,
  submission_id TEXT NOT NULL REFERENCES submissions(id),
  revision_id TEXT NOT NULL,
  metadata TEXT NOT NULL,
  signature TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sent','archived')),
  created_at INTEGER NOT NULL,
  handled_at INTEGER
);
CREATE INDEX beauty_repos_status ON beauty_repos(status,created_at,id);
CREATE INDEX beauty_repos_submission ON beauty_repos(submission_id,created_at,id);
