CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY, device_hash TEXT UNIQUE NOT NULL, consent_hash TEXT UNIQUE NOT NULL
);
CREATE TABLE IF NOT EXISTS requests (
  owner TEXT NOT NULL, id TEXT NOT NULL, brief TEXT NOT NULL, state TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 0, approved INTEGER, feedback TEXT, created INTEGER NOT NULL,
  PRIMARY KEY(owner,id)
);
CREATE TABLE IF NOT EXISTS drafts (
  owner TEXT NOT NULL, id TEXT NOT NULL, version INTEGER NOT NULL, digest TEXT NOT NULL, content TEXT NOT NULL,
  PRIMARY KEY(owner,id,version)
);
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY, owner TEXT NOT NULL, url TEXT NOT NULL, secret TEXT NOT NULL,
  old_secret TEXT, rotate_until INTEGER, expires INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS subscription_owner ON subscriptions(owner,expires);
CREATE TABLE IF NOT EXISTS subscription_grants (
  sub TEXT PRIMARY KEY REFERENCES subscriptions(id) ON DELETE CASCADE,
  grant_id TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY, owner TEXT NOT NULL, request_id TEXT NOT NULL, created INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS events_owner ON events(owner,created);
CREATE TABLE IF NOT EXISTS deliveries (
  event TEXT NOT NULL, sub TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
  lease_until INTEGER NOT NULL DEFAULT 0, status INTEGER, received INTEGER,
  PRIMARY KEY(event,sub)
);
CREATE INDEX IF NOT EXISTS retry_delivery ON deliveries(lease_until) WHERE received IS NULL AND attempts<12;
