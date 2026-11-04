-- V29 portfolio-only statistics. No IPs, user agents, referrers or chat data.
CREATE TABLE IF NOT EXISTS daily_sessions (
 day TEXT NOT NULL,
 session_hash TEXT NOT NULL,
 PRIMARY KEY (day, session_hash)
);
CREATE TABLE IF NOT EXISTS daily_totals (
 day TEXT PRIMARY KEY,
 pageviews INTEGER NOT NULL DEFAULT 0 CHECK(pageviews >= 0),
 sessions INTEGER NOT NULL DEFAULT 0 CHECK(sessions >= 0)
);
CREATE TABLE IF NOT EXISTS daily_pages (
 day TEXT NOT NULL,
 path TEXT NOT NULL,
 pageviews INTEGER NOT NULL DEFAULT 0 CHECK(pageviews >= 0),
 PRIMARY KEY(day,path)
);
CREATE INDEX IF NOT EXISTS idx_daily_pages_path_day ON daily_pages(path,day);
