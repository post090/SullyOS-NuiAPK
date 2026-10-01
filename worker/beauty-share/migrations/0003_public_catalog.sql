ALTER TABLE revisions ADD COLUMN catalog_cover TEXT NOT NULL DEFAULT '';
ALTER TABLE submissions ADD COLUMN catalog_hidden INTEGER NOT NULL DEFAULT 0;
-- No historical work is opted in: consent lives in each reviewed revision's metadata.
