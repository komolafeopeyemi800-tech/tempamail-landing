CREATE TABLE IF NOT EXISTS messages (
  id          TEXT PRIMARY KEY,
  address     TEXT NOT NULL,
  from_addr   TEXT,
  from_name   TEXT,
  subject     TEXT,
  text        TEXT,
  html        TEXT,
  received_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_address
  ON messages (address, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_received
  ON messages (received_at);
